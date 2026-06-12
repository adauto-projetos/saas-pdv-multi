"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createPayableAction } from "@/app/(app)/financeiro/pagar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";

/** Conta a pagar: descrição + valor + categoria + vencimento (RF11). */
export function NewPayableForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [description, setDescription] = React.useState("");
  const [totalCents, setTotalCents] = React.useState<number | null>(null);
  const [category, setCategory] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (description.trim() === "") {
      toast.error("Informe a descrição.");
      return;
    }
    if (totalCents == null || totalCents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (category.trim() === "") {
      toast.error("Informe a categoria.");
      return;
    }

    setSubmitting(true);
    const res = await createPayableAction({
      description,
      totalCents,
      category,
      dueDate: dueDate || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Conta a pagar criada");
    setDescription("");
    setTotalCents(null);
    setCategory("");
    setDueDate("");
    onCreated?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="payable-description">Descrição</Label>
        <Input
          id="payable-description"
          className="text-base"
          placeholder="Ex.: conta de luz"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payable-total">Valor</Label>
        <MoneyInput
          id="payable-total"
          value={totalCents}
          onChange={setTotalCents}
          placeholder="R$ 0,00"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payable-category-input">Categoria</Label>
        <Input
          id="payable-category-input"
          className="text-base"
          placeholder="Ex.: energia, aluguel, fornecedor"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payable-due">Vencimento (opcional)</Label>
        <Input
          id="payable-due"
          type="date"
          className="w-44 text-base"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Salvando..." : "Criar conta a pagar"}
      </Button>
    </form>
  );
}
