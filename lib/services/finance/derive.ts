import type { AccountStatus } from "@/types/finance";

/** Data de hoje em "YYYY-MM-DD" (fuso do servidor), para comparar com due_date. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
