import type { ProductUnit } from "@/types/product";

export type ComandaStatus = "aberta" | "fechada" | "cancelada";

/**
 * Item de uma comanda aberta. `unitPriceCents` é o preço CORRENTE do produto
 * (não congelado) — RN05. O snapshot de preço só ocorre no fechamento.
 */
export type ComandaItemDto = {
  id: string;
  productId: string | null;
  name: string;
  unit: ProductUnit;
  /** Preço corrente do produto — NÃO snapshot (RN05). */
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  observation: string | null;
};

/**
 * Comanda completa com itens. `partialTotalCents` é informativo (RF05):
 * Σ(preço corrente × qtd) — pode divergir do total do fechamento se o preço
 * do produto mudar durante o atendimento (RN05).
 */
export type ComandaDto = {
  id: string;
  label: string;
  status: ComandaStatus;
  openedBy: string;
  openedAt: Date;
  closedBy: string | null;
  closedAt: Date | null;
  saleId: string | null;
  /** Σ(preço corrente × qtd) — informativo (RF05/RN05). */
  partialTotalCents: number;
  items: ComandaItemDto[];
};

/**
 * Resultado de `addComandaItem` (0007F): comanda atualizada + item inserido.
 * O item é retornado para que o caller possa acionar `tryKitchenPrint` sem
 * precisar buscá-lo novamente no banco (RF01/RN04).
 */
export type AddComandaItemResult = {
  comanda: ComandaDto;
  item: ComandaItemDto;
};

/**
 * Linha de histórico de comanda (RF08). Sem itens — só metadados para a lista.
 */
export type ComandaSummaryDto = {
  id: string;
  label: string;
  status: ComandaStatus;
  openedAt: Date;
  closedAt: Date | null;
  saleId: string | null;
};
