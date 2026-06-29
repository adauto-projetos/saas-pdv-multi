// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { overrideLog } from "@/db/schema";
import { selectOverrides } from "@/lib/services/audit/audit-data";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

/**
 * Testes do índice composto override_log_tenant_created_action_idx (RNF01).
 *
 * audit-RNF01-index: Verifica via EXPLAIN que a query de auditoria usa Index Scan
 *   (não Seq Scan) sobre override_log. Para garantir que o planner prefira o índice
 *   em tabela pequena, desabilita seqscan localmente com SET LOCAL enable_seqscan=off.
 *   Ao mesmo tempo, semeia 50+ linhas para reforçar a preferência pelo índice.
 *
 * audit-RNF01-result: Verifica que o índice não altera o resultado — as linhas
 *   retornadas por selectOverrides() correspondem exatamente ao subconjunto
 *   tenant/data esperado.
 */
suite("override_log composite index (RNF01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";

  // Intervalo de consulta dos testes
  const fromDate = new Date("2025-01-01T00:00:00Z");
  const toDate = new Date("2025-12-31T23:59:59Z");
  const fromStr = fromDate.toISOString();
  const toStr = toDate.toISOString();

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Index Test");
    tenantB = await seedTenant(userB.userId, "Loja B Index Test");

    // Semeia 50 linhas no tenantA dentro do intervalo
    // (volume suficiente para o planner preferir o índice sem forçar seqscan=off)
    const rowsA = Array.from({ length: 50 }, (_, i) => ({
      tenantId: tenantA,
      actorUserId: userA.userId,
      authorizerUserId: userA.userId,
      actionCode: i % 2 === 0 ? "cancelar_comanda" : "estornar_venda",
      targetRef: `ref-a-${i}`,
      // Espalha as 50 linhas pelos 12 meses de 2025 (mês sempre 1–12, dia 1–28).
      createdAt: new Date(
        `2025-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      ),
    }));
    await db.insert(overrideLog).values(rowsA);

    // Semeia 3 linhas no tenantB: 2 dentro do intervalo, 1 fora
    await db.insert(overrideLog).values([
      {
        tenantId: tenantB,
        actorUserId: userB.userId,
        authorizerUserId: userB.userId,
        actionCode: "cancelar_comanda",
        targetRef: "ref-b-1",
        createdAt: new Date("2025-03-15T10:00:00Z"),
      },
      {
        tenantId: tenantB,
        actorUserId: userB.userId,
        authorizerUserId: userB.userId,
        actionCode: "estornar_venda",
        targetRef: "ref-b-2",
        createdAt: new Date("2025-07-20T10:00:00Z"),
      },
      {
        tenantId: tenantB,
        actorUserId: userB.userId,
        authorizerUserId: userB.userId,
        actionCode: "cancelar_comanda",
        targetRef: "ref-b-outside-range",
        // Fora do intervalo de consulta — não deve aparecer nos resultados
        createdAt: new Date("2024-01-01T10:00:00Z"),
      },
    ]);
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    for (const u of [userA, userB]) {
      if (u.userId) await deleteTestUser(u.userId);
    }
  });

  it("audit-RNF01-index — query de auditoria usa Index Scan (não Seq Scan) no override_log", async () => {
    // Usa SET LOCAL enable_seqscan=off dentro de uma transação para forçar/verificar
    // que o índice override_log_tenant_created_action_idx existe e é utilizável.
    // Isso não afeta outros testes pois SET LOCAL vale apenas dentro da transação.
    // Em produção (tabelas grandes), o planner escolheria o índice automaticamente.
    const planRows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL enable_seqscan = off`);
      // Datas como ISO string com cast explícito (postgres-js não aceita Date cru
      // num parâmetro de sql template); espelha o binding de selectOverrides.
      return tx.execute<{ "QUERY PLAN": string }>(sql`
        EXPLAIN (FORMAT TEXT)
        SELECT id, action_code, created_at
        FROM override_log
        WHERE tenant_id = ${tenantA}
          AND created_at BETWEEN ${fromStr}::timestamptz AND ${toStr}::timestamptz
      `);
    });

    const planLines = (
      planRows as unknown as Array<{ "QUERY PLAN": string }>
    )
      .map((r) => r["QUERY PLAN"])
      .join("\n");

    // O plano deve referenciar o índice composto
    expect(planLines).toMatch(/Index (Scan|Only Scan|Cond)|Bitmap Index Scan/i);
    expect(planLines).toMatch(/override_log_tenant_created_action_idx/i);
    // Não deve usar Seq Scan na tabela override_log
    expect(planLines).not.toMatch(/Seq Scan on override_log/i);
  });

  it("audit-RNF01-result — índice não altera resultado de selectOverrides()", async () => {
    // tenantB tem 2 linhas dentro do intervalo (ref-b-1 e ref-b-2)
    // e 1 fora do intervalo (ref-b-outside-range, 2024) — não deve aparecer
    const rows = await selectOverrides(tenantB, fromStr, toStr);

    expect(rows).toHaveLength(2);

    const targetRefs = rows.map((r) => r.targetRef).sort();
    expect(targetRefs).toEqual(["ref-b-1", "ref-b-2"]);

    // Nenhuma linha do tenantA deve aparecer
    for (const r of rows) {
      expect(r.targetRef).not.toMatch(/^ref-a-/);
    }

    // Campos básicos presentes e coerentes
    for (const r of rows) {
      expect(r.actionCode).toBeTruthy();
      expect(r.createdAt).toBeTruthy();
      const d = new Date(r.createdAt);
      expect(d.getFullYear()).toBe(2025);
    }
  });
});
