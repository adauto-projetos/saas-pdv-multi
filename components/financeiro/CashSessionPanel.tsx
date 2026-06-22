"use client";

import { CloseSessionDialog } from "@/components/financeiro/CloseSessionDialog";
import { OpenSessionDialog } from "@/components/financeiro/OpenSessionDialog";
import { HelpTip, InfoButton } from "@/components/ui/help-tip";
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
        <HelpTip
          text="Inicia o turno de trabalho do dia"
          detail={"Ao abrir o turno, você registra quanto dinheiro tem no caixa neste momento. O sistema começa a registrar as vendas a partir daqui.\n\nSempre abra o turno antes de começar a atender os clientes."}
          dialogTitle="Abrir turno"
          style={{ width: "fit-content" }}
        >
          <OpenSessionDialog />
        </HelpTip>
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
        <span className="ml-2 inline-flex items-center text-[12px] font-normal text-gray-400">
          saldo inicial
          <InfoButton
            title="Saldo do caixa"
            detail="É o valor em dinheiro que deveria estar no caixa agora, baseado nas vendas em dinheiro e nas movimentações registradas desde a abertura do turno."
          />
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
      <HelpTip
        text="Encerra o turno e fecha o caixa do dia"
        detail={"Ao fechar o turno, você conta o dinheiro que tem no caixa e informa ao sistema. O sistema compara com o que deveria ter e mostra se houve diferença (sobra ou falta).\n\nFaça isso no final do expediente."}
        dialogTitle="Fechar turno"
        style={{ width: "fit-content" }}
      >
        <CloseSessionDialog />
      </HelpTip>
    </PageCard>
  );
}
