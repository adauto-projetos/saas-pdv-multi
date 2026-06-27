/**
 * DTOs do lucro e do fechamento de caixa (0005F). Dinheiro = inteiro em centavos;
 * `profitCents` PODE ser negativo (prejuízo — RN02). Datas saem como ISO strings.
 */

/** Lucro do período: agregação direta sobre sale_items × sales (sem cache — RNF01). */
export type ProfitDto = {
  /** Faturamento = Σ subtotal_cents das vendas no período. */
  revenueCents: number;
  /** Custo = Σ (cost_cents_snapshot ?? 0) × quantity. Itens sem custo contam 0 (RN04). */
  costCents: number;
  /** Lucro = revenue − cost. PODE ser negativo (prejuízo — RN02). */
  profitCents: number;
  /** Margem % = round(profit ÷ revenue × 100); 0 quando revenue = 0 (RNF01). */
  marginPercent: number;
  /** Quantidade de itens sem custo (snapshot null) — flag de lucro superestimado (RF03/RN04). */
  itemsWithoutCost: number;
  /** Vendas distintas no período. */
  salesCount: number;
};

/** Estado de uma sessão de caixa (turno). */
export type CashSessionStatus = "aberta" | "fechada";

/**
 * Sessão de caixa (turno). Campos de fechamento (closedAt/closedBy/counted/
 * expected/divergence) ficam null enquanto 'aberta'. Imutável após fechada (RN08).
 */
export type CashSessionDto = {
  id: string;
  openingBalanceCents: number;
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  countedCents: number | null;
  /** Conferência de cartão/pix preenchida pelo operador no fechamento (0014F). */
  countedCardCents: number | null;
  countedPixCents: number | null;
  /** Esperado = opening + Σ dinheiro do turno (RN06). null enquanto aberta. */
  expectedCents: number | null;
  /** Divergência = contado − esperado (sobra/falta — RN07). null enquanto aberta. */
  divergenceCents: number | null;
  status: CashSessionStatus;
};
