"use client";

import { CloseSessionDialog } from "@/components/financeiro/CloseSessionDialog";
import { OpenSessionDialog } from "@/components/financeiro/OpenSessionDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Turno</CardDescription>
          <CardTitle>Nenhum caixa aberto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Abra o caixa informando o saldo inicial para começar o turno.
          </p>
          <OpenSessionDialog />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardDescription>Turno aberto</CardDescription>
        <CardTitle className="font-mono">
          {centsToBRL(session.openingBalanceCents)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            saldo inicial
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Aberto em</span>
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
      </CardContent>
    </Card>
  );
}
