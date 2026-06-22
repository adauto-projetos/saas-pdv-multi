"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createCustomerAction } from "@/app/(app)/financeiro/customers/actions";
import { Button } from "@/components/ui/button";
import { HelpTip, InfoButton } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cadastra cliente: nome (obrigatório) + telefone (opcional) (RF06). */
export function CustomerForm() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") {
      toast.error("Informe o nome do cliente.");
      return;
    }

    setSubmitting(true);
    const res = await createCustomerAction({
      name,
      phone: phone.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente cadastrado");
    setName("");
    setPhone("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="customer-name">Nome</Label>
          <InfoButton
            title="Nome do cliente"
            detail="Digite o nome completo do cliente. Esse nome vai aparecer nas vendas no fiado e nos relatórios. Pode ser um apelido também, desde que seja fácil de identificar."
          />
        </div>
        <Input
          id="customer-name"
          className="text-base"
          placeholder="Ex.: João da Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center">
          <Label htmlFor="customer-phone">Telefone (opcional)</Label>
          <InfoButton
            title="Telefone (opcional)"
            detail="Salvar o telefone ajuda a entrar em contato com o cliente para cobrar o fiado ou avisar sobre promoções. Não é obrigatório."
          />
        </div>
        <Input
          id="customer-phone"
          type="tel"
          inputMode="tel"
          className="text-base"
          placeholder="Ex.: (11) 90000-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <HelpTip
        text="Cadastra o cliente no sistema"
        detail="Após cadastrar, o cliente vai aparecer na lista e você poderá registrar vendas no fiado para ele no Caixa."
        dialogTitle="Cadastrar cliente"
        style={{ width: "fit-content" }}
      >
        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Salvando..." : "Cadastrar cliente"}
        </Button>
      </HelpTip>
    </form>
  );
}
