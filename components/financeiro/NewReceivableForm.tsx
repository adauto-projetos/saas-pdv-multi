"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createReceivableAction } from "@/app/(app)/financeiro/receber/actions";
import { Button } from "@/components/ui/button";
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
        <Label htmlFor="receivable-customer">Cliente</Label>
        <CustomerPicker
          inputId="receivable-customer"
          value={customer}
          onSelect={setCustomer}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="receivable-total">Valor</Label>
        <MoneyInput
          id="receivable-total"
          value={totalCents}
          onChange={setTotalCents}
          placeholder="R$ 0,00"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="receivable-description">Descrição (opcional)</Label>
        <Input
          id="receivable-description"
          className="text-base"
          placeholder="Ex.: fiado da semana"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="receivable-due">Vencimento (opcional)</Label>
        <Input
          id="receivable-due"
          type="date"
          className="w-44 text-base"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Salvando..." : "Criar conta a receber"}
      </Button>
    </form>
  );
}
