"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createReceivableAction } from "@/app/(app)/financeiro/receber/actions";
import { Button } from "@/components/ui/button";
import { HelpTip, InfoButton } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import type { CustomerDto } from "@/types/finance";

import { CustomerPicker } from "./CustomerPicker";

/** Conta a receber avulsa: cliente + valor + descrição + vencimento (RF08). */
export function NewReceivableForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [customer, setCustomer] = React.useState<CustomerDto | null>(null);
  const [totalCents, setTotalCents] = React.useState<number | null>(null);
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!customer) {
      toast.error("Selecione um cliente.");
      return;
    }
    if (totalCents == null || totalCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    setSubmitting(true);
    const res = await createReceivableAction({
      customerId: customer.id,
      totalCents,
      description: description.trim() || undefined,
      dueDate: dueDate || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Conta a receber criada");
    setCustomer(null);
    setTotalCents(null);
    setDescription("");
    setDueDate("");
    onCreated?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="receivable-customer">Cliente</Label>
          <InfoButton
            title="Cliente"
            detail="Quem está devendo. O cliente precisa estar cadastrado antes (em Financeiro → Clientes). Cada conta a receber pertence a um cliente."
          />
        </div>
        <CustomerPicker
          inputId="receivable-customer"
          value={customer}
          onSelect={setCustomer}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="receivable-total">Valor</Label>
          <InfoButton
            title="Valor a receber"
            detail="Quanto o cliente está devendo nesta conta. Você pode receber em partes depois, até quitar tudo."
          />
        </div>
        <MoneyInput
          id="receivable-total"
          value={totalCents}
          onChange={setTotalCents}
          placeholder="R$ 0,00"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="receivable-description">Descrição (opcional)</Label>
          <InfoButton
            title="Descrição"
            detail="Uma nota para lembrar do que se trata o fiado. Ex.: 'fiado da semana', 'compra do mês'. É opcional."
          />
        </div>
        <Input
          id="receivable-description"
          className="text-base"
          placeholder="Ex.: fiado da semana"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="receivable-due">Vencimento (opcional)</Label>
          <InfoButton
            title="Vencimento"
            detail="A data em que o cliente deveria pagar. Contas vencidas e ainda abertas ficam marcadas, ajudando a saber quem cobrar. É opcional."
          />
        </div>
        <Input
          id="receivable-due"
          type="date"
          className="w-44 text-base"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <HelpTip
        text="Cria a conta a receber"
        detail="Registra o quanto o cliente deve. A conta aparece na lista e em Clientes (somando no total em aberto). Ao receber, em dinheiro o valor entra no caixa."
        dialogTitle="Criar conta a receber"
        style={{ width: "fit-content" }}
      >
        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Salvando..." : "Criar conta a receber"}
        </Button>
      </HelpTip>
    </form>
  );
}
