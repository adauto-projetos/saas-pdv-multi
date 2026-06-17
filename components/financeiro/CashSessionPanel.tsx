"use client";

import { CloseSessionDialog } from "@/components/financeiro/CloseSessionDialog";
import { OpenSessionDialog } from "@/components/financeiro/OpenSessionDialog";
import { PageCard } from "@/components/ui/PageCard";
import { centsToBRL } from "@/lib/format/money";
import type { CashSessionDto } from "@/types/profit";

/**
 * RF04/RF06/RF08 — painel do turno de caixa. Sem sessão → "Abrir caixa".
 * Com sessão aberta → mostra abertura/saldo inicial + "Fechar caixa".
 */
export function CashSessionPanel({
  session,
}: {
  session: CashSessionDto | null;
}) {
  if (!session) {
    return (
      <PageCard className="p-5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400">
          Turno
        </div>
        <div className="mb-1.5 text-[14px] font-semibold text-gray-900">
          Nenhum caixa aberto
        </div>
        <p className="mb-4 text-[12px] leading-relaxed text-gray-500">
          Abra o caixa informando o saldo inicial para começar o turno.
        </p>
        <OpenSessionDialog />
      </PageCard>
    );
  }

  return (
    <PageCard className="p-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400">
        Turno aberto
      </div>
      <div className="mb-1.5 text-[24px] font-bold text-gray-900">
        {centsToBRL(session.openingBalanceCents)}
        <span className="ml-2 text-[12px] font-normal text-gray-400">
          saldo inicial
        </span>
      </div>
      <div className="mb-4 flex items-center justify-between text-[12px] text-gray-500">
        <span>Aberto em</span>
        <span>
          {new Date(session.openedAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <CloseSessionDialog />
    </PageCard>
  );
}
