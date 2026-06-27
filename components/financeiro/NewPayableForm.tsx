"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createPayableAction } from "@/app/(app)/financeiro/pagar/actions";
import { Button } from "@/components/ui/button";
import { HelpTip, InfoButton } from "@/components/ui/help-tip";
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
        <div className="flex items-center">
          <Label htmlFor="payable-description">Descrição</Label>
          <InfoButton
            title="Descrição da conta"
            detail="O que é essa despesa. Ex.: 'conta de luz', 'fornecedor de bebidas', 'aluguel'. Use um nome que você reconheça depois na lista."
          />
        </div>
        <Input
          id="payable-description"
          className="text-base"
          placeholder="Ex.: conta de luz"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="payable-total">Valor</Label>
          <InfoButton
            title="Valor da conta"
            detail="Quanto você precisa pagar no total. Você pode registrar pagamentos parciais depois, até quitar a conta."
          />
        </div>
        <MoneyInput
          id="payable-total"
          value={totalCents}
          onChange={setTotalCents}
          placeholder="R$ 0,00"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="payable-category-input">Categoria</Label>
          <InfoButton
            title="Categoria da despesa"
            detail="Agrupa as contas por tipo (energia, aluguel, fornecedor, etc.). Ajuda a entender para onde o dinheiro está indo."
          />
        </div>
        <Input
          id="payable-category-input"
          className="text-base"
          placeholder="Ex.: energia, aluguel, fornecedor"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="payable-due">Vencimento (opcional)</Label>
          <InfoButton
            title="Vencimento"
            detail="A data-limite para pagar. Contas que passam dessa data e ainda não foram pagas ficam marcadas como vencidas. É opcional."
          />
        </div>
        <Input
          id="payable-due"
          type="date"
          className="w-44 text-base"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <HelpTip
        text="Cria a conta a pagar"
        detail="A conta entra na lista de contas a pagar. Depois você registra o pagamento (total ou parcial) escolhendo a forma. Em dinheiro, o valor sai do caixa."
        dialogTitle="Criar conta a pagar"
        style={{ width: "fit-content" }}
      >
        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Salvando..." : "Criar conta a pagar"}
        </Button>
      </HelpTip>
    </form>
  );
}
