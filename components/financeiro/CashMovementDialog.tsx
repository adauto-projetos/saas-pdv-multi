"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  registerCashInflowAction,
  registerCashOutflowAction,
} from "@/app/(app)/financeiro/caixa/actions";
import { Button } from "@/components/ui/button";
import { InfoButton } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";

type Mode = "entrada" | "saida";

/** Suprimento (entrada) ou sangria (saída) manual no caixa (RF01/RF02). */
export function CashMovementDialog() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("entrada");
  const [amountCents, setAmountCents] = React.useState<number | null>(null);
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (amountCents == null || amountCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (description.trim() === "") {
      toast.error("Informe uma descrição.");
      return;
    }

    setSubmitting(true);
    const res =
      mode === "entrada"
        ? await registerCashInflowAction({ amountCents, description })
        : await registerCashOutflowAction({ amountCents, description });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === "entrada" ? "Suprimento registrado" : "Sangria registrada");
    setAmountCents(null);
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <div className="flex items-center">
          <span className="text-sm font-medium leading-none">Tipo</span>
          <InfoButton
            title="Suprimento ou Sangria?"
            detail={"Suprimento: Dinheiro que você COLOCA no caixa. Geralmente feito no começo do dia para ter troco disponível. Ex: você coloca R$ 100 em notas pequenas.\n\nSangria: Dinheiro que você RETIRA do caixa. Feito quando o caixa está muito cheio e você quer guardar parte no cofre por segurança."}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "entrada" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("entrada")}
          >
            Suprimento (entrada)
          </Button>
          <Button
            type="button"
            variant={mode === "saida" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("saida")}
          >
            Sangria (saída)
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="cash-amount">Valor</Label>
          <InfoButton
            title="Valor"
            detail="Digite o valor em reais. Use vírgula para centavos, ex: 150,00. Esse valor vai ser somado (suprimento) ou subtraído (sangria) do saldo atual do caixa."
          />
        </div>
        <MoneyInput
          id="cash-amount"
          value={amountCents}
          onChange={setAmountCents}
          placeholder="R$ 0,00"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="cash-description">Descrição</Label>
          <InfoButton
            title="Descrição da movimentação"
            detail="Escreva o motivo da movimentação. Isso ajuda a entender o histórico do caixa depois. Ex: 'troco inicial', 'retirada para banco', 'pagamento de fornecedor'."
          />
        </div>
        <Input
          id="cash-description"
          className="text-base"
          placeholder={
            mode === "entrada" ? "Ex.: troco inicial" : "Ex.: retirada para banco"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Salvando..." : "Registrar movimentação"}
      </Button>
    </form>
  );
}
