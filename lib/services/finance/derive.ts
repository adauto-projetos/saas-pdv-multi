import { todayBrazilIso } from "@/lib/business-day";
import type { AccountStatus } from "@/types/finance";

/**
 * Data de hoje em "YYYY-MM-DD" (fuso do Brasil, UTC-3 — hotfix 0027H: antes
 * usava getters locais do runtime, que em produção refletem UTC e marcavam
 * contas como vencidas 3h antes da meia-noite local), para comparar com due_date.
 */
export function todayIso(): string {
  return todayBrazilIso();
}

/** Status derivado do saldo (RN04): aberto / parcial / quitado. */
export function deriveStatus(
  totalCents: number,
  paidCents: number,
): AccountStatus {
  const remaining = totalCents - paidCents;
  if (remaining <= 0) return "quitado";
  if (paidCents === 0) return "aberto";
  return "parcial";
}

/** Em atraso: tem vencimento, saldo devedor > 0 e venceu antes de hoje (RF14). */
export function deriveOverdue(
  dueDate: string | null,
  remainingCents: number,
): boolean {
  if (dueDate == null || remainingCents <= 0) return false;
  return dueDate < todayIso();
}
