"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { createCustomerAction } from "@/app/(app)/financeiro/customers/actions";
import { Button } from "@/components/ui/button";
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
        <Label htmlFor="customer-name">Nome</Label>
        <Input
          id="customer-name"
          className="text-base"
          placeholder="Ex.: João da Silva"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="customer-phone">Telefone (opcional)</Label>
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

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Salvando..." : "Cadastrar cliente"}
      </Button>
    </form>
  );
}
