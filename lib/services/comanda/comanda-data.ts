import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { comandaItems, comandas, products } from "@/db/schema";
import type { ComandaDto, ComandaItemDto, ComandaSummaryDto, ComandaStatus } from "@/types/comanda";
import type { ProductUnit } from "@/types/product";

/**
 * Data layer das comandas/mesa (0006F). Espelha cash-session-data.ts para
 * lifecycle e finance/cash-data.ts para padrão geral. Executor = db ou RlsTx;
 * o service decide o contexto (sempre `withUserRls`). TODA função filtra por
 * `tenant_id` — filtro de aplicação aditivo à RLS (RN01).
 */
type Executor = Pick<Database, "insert" | "select" | "update" | "delete">;

// ---- mappers ----------------------------------------------------------------

/**
 * Monta ComandaItemDto a partir de uma linha de comanda_items LEFT JOIN products.
 * `unitPriceCents` = preço CORRENTE do produto (não snapshot — RN05).
 * Quando `product_id` é null (produto removido do catálogo via SET NULL), os campos
 * de produto ficam null — o serviço rejeita o fechamento nesse caso (ValidationError).
 */
function toComandaItemDto(row: {
  id: string;
  productId: string | null;
  quantity: string;
  observation: string | null;
  name: string | null;
  unit: string | null;
  salePriceCents: number | null;
}): ComandaItemDto {
  const qty = Number(row.quantity);
  const unitPriceCents = row.salePriceCents ?? 0;
  return {
    id: row.id,
    productId: row.productId,
    name: row.name ?? "(produto removido)",
    unit: (row.unit ?? "un") as ProductUnit,
    unitPriceCents,
    quantity: qty,
    subtotalCents: Math.round(unitPriceCents * qty),
    observation: row.observation,
  };
}

function toComandaDto(
  row: typeof comandas.$inferSelect,
  items: ComandaItemDto[],
): ComandaDto {
  const partialTotalCents = items.reduce((sum, i) => sum + i.subtotalCents, 0);
  return {
    id: row.id,
    label: row.label,
    status: row.status as ComandaStatus,
    openedBy: row.openedBy,
    openedAt: row.openedAt,
    closedBy: row.closedBy,
    closedAt: row.closedAt,
    saleId: row.saleId,
    partialTotalCents,
    items,
  };
}

function toComandaSummaryDto(
  row: typeof comandas.$inferSelect,
): ComandaSummaryDto {
  return {
    id: row.id,
    label: row.label,
    status: row.status as ComandaStatus,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    saleId: row.saleId,
  };
}

// ---- helpers ----------------------------------------------------------------

/**
 * Busca os itens de uma lista de comandas num único JOIN com products (RNF01).
 * Retorna mapa comandaId → ComandaItemDto[].
 */
async function selectItemsByComandaIds(
  tx: Executor,
  tenantId: string,
  comandaIds: string[],
): Promise<Map<string, ComandaItemDto[]>> {
  if (comandaIds.length === 0) return new Map();

  // Drizzle não tem inArray com valores literais de forma direta neste contexto;
  // usamos o sql tag para montar a cláusula IN.
  const rows = await tx
    .select({
      id: comandaItems.id,
      comandaId: comandaItems.comandaId,
      productId: comandaItems.productId,
      quantity: comandaItems.quantity,
      observation: comandaItems.observation,
      name: products.name,
      unit: products.unit,
      salePriceCents: products.salePriceCents,
    })
    .from(comandaItems)
    // LEFT JOIN: itens cujo produto foi removido (product_id SET NULL) ainda aparecem
    // no DTO — o serviço rejeita o fechamento se encontrar produto indisponível (RN05).
    .leftJoin(products, eq(comandaItems.productId, products.id))
    .where(
      and(
        eq(comandaItems.tenantId, tenantId),
        inArray(comandaItems.comandaId, comandaIds),
      ),
    );

  const map = new Map<string, ComandaItemDto[]>();
  for (const row of rows) {
    const list = map.get(row.comandaId) ?? [];
    list.push(toComandaItemDto(row));
    map.set(row.comandaId, list);
  }
  return map;
}

// ---- public API -------------------------------------------------------------

/**
 * Insere uma comanda 'aberta' (RF01). Sem unique conflict — RN04 permite
 * várias abertas por tenant. `openedBy` do ctx (RN10).
 */
export async function insertComanda(
  tx: Executor,
  tenantId: string,
  userId: string,
  label: string,
): Promise<typeof comandas.$inferSelect> {
  const [row] = await tx
    .insert(comandas)
    .values({ tenantId, openedBy: userId, label, status: "aberta" })
    .returning();
  return row;
}

/**
 * Comanda + itens JOIN products (preço corrente) por id. Retorna null se não existe.
 * Usado antes de qualquer operação na comanda (add/remove/cancel/close).
 */
export async function selectComandaById(
  tx: Executor,
  tenantId: string,
  comandaId: string,
): Promise<ComandaDto | null> {
  const [row] = await tx
    .select()
    .from(comandas)
    .where(and(eq(comandas.tenantId, tenantId), eq(comandas.id, comandaId)))
    .limit(1);
  if (!row) return null;

  // LEFT JOIN com products para preço corrente (RN05, RNF01).
  // LEFT JOIN (não INNER) para que itens de produto removido do catálogo
  // (product_id SET NULL) apareçam com productId=null — o serviço rejeita
  // o fechamento nesses casos em vez de silenciosamente ignorar os itens.
  const itemRows = await tx
    .select({
      id: comandaItems.id,
      comandaId: comandaItems.comandaId,
      productId: comandaItems.productId,
      quantity: comandaItems.quantity,
      observation: comandaItems.observation,
      name: products.name,
      unit: products.unit,
      salePriceCents: products.salePriceCents,
    })
    .from(comandaItems)
    .leftJoin(products, eq(comandaItems.productId, products.id))
    .where(
      and(
        eq(comandaItems.tenantId, tenantId),
        eq(comandaItems.comandaId, comandaId),
      ),
    );

  const items = itemRows.map(toComandaItemDto);
  return toComandaDto(row, items);
}

/**
 * Todas as comandas 'aberta' do tenant + itens JOIN products (RNF01).
 * Usa índice (tenant_id, status) — responde rápido (RNF01).
 */
export async function selectOpenComandas(
  tx: Executor,
  tenantId: string,
): Promise<ComandaDto[]> {
  const rows = await tx
    .select()
    .from(comandas)
    .where(
      and(eq(comandas.tenantId, tenantId), eq(comandas.status, "aberta")),
    )
    .orderBy(desc(comandas.openedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const itemsMap = await selectItemsByComandaIds(tx, tenantId, ids);

  return rows.map((r) => toComandaDto(r, itemsMap.get(r.id) ?? []));
}

/**
 * Insere um item na comanda (RF02). Sem preço — snapshot só no fechamento (RN05).
 * observation é nullable (RN11).
 */
export async function insertComandaItem(
  tx: Executor,
  tenantId: string,
  comandaId: string,
  productId: string,
  quantity: number,
  observation?: string | null,
): Promise<typeof comandaItems.$inferSelect> {
  const [row] = await tx
    .insert(comandaItems)
    .values({
      tenantId,
      comandaId,
      productId,
      quantity: quantity.toString(),
      observation: observation ?? null,
    })
    .returning();
  return row;
}

/**
 * Remove item pelo id (RF03). Caller garante estorno de estoque na mesma tx (RNF02).
 */
export async function deleteComandaItem(
  tx: Executor,
  tenantId: string,
  comandaId: string,
  itemId: string,
): Promise<void> {
  await tx
    .delete(comandaItems)
    .where(
      and(
        eq(comandaItems.tenantId, tenantId),
        eq(comandaItems.comandaId, comandaId),
        eq(comandaItems.id, itemId),
      ),
    );
}

/**
 * Transição status='fechada'. WHERE status='aberta' é guarda de corrida (RN06).
 * Retorna null se a comanda não estava 'aberta' (corrida).
 */
export async function closeComandaRow(
  tx: Executor,
  tenantId: string,
  comandaId: string,
  saleId: string,
  closedBy: string,
): Promise<typeof comandas.$inferSelect | null> {
  const [row] = await tx
    .update(comandas)
    .set({
      status: "fechada",
      saleId,
      closedBy,
      closedAt: new Date(),
    })
    .where(
      and(
        eq(comandas.id, comandaId),
        eq(comandas.tenantId, tenantId),
        eq(comandas.status, "aberta"),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Transição status='cancelada'. WHERE status='aberta' é guarda de corrida (RN06).
 * Retorna null se a comanda não estava 'aberta'.
 */
export async function cancelComandaRow(
  tx: Executor,
  tenantId: string,
  comandaId: string,
  closedBy: string,
): Promise<typeof comandas.$inferSelect | null> {
  const [row] = await tx
    .update(comandas)
    .set({
      status: "cancelada",
      closedBy,
      closedAt: new Date(),
    })
    .where(
      and(
        eq(comandas.id, comandaId),
        eq(comandas.tenantId, tenantId),
        eq(comandas.status, "aberta"),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Histórico de comandas fechadas/canceladas (RF08). Filtrável por from/to/status.
 * Abertas NÃO aparecem aqui (abertas estão na tela principal via selectOpenComandas).
 */
export async function selectComandaHistory(
  tx: Executor,
  tenantId: string,
  filter: { from?: string; to?: string; status?: "aberta" | "fechada" | "cancelada" } = {},
): Promise<ComandaSummaryDto[]> {
  const conds = [
    eq(comandas.tenantId, tenantId),
    // Histórico = apenas fechadas/canceladas, a menos que o filtro force 'aberta'
    // (uso avançado). Sem filtro explícito de status: só mostra terminais.
    filter.status
      ? eq(comandas.status, filter.status)
      : sql`${comandas.status} in ('fechada', 'cancelada')`,
  ];

  const fromDate = filter.from ? new Date(filter.from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    conds.push(gte(comandas.openedAt, fromDate));
  }
  const toDate = filter.to ? new Date(filter.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    conds.push(lte(comandas.openedAt, toDate));
  }

  const rows = await tx
    .select()
    .from(comandas)
    .where(and(...conds))
    .orderBy(desc(comandas.openedAt));

  return rows.map(toComandaSummaryDto);
}
