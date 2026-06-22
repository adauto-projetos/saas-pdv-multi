"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { updateDefaultMarkupAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { HelpTip, InfoButton } from "@/components/ui/help-tip";
import { Label } from "@/components/ui/label";
import { PercentInput } from "@/components/ui/PercentInput";

export function DefaultMarkupSettingsForm({
  defaultMarginPercent,
}: {
  defaultMarginPercent: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = React.useState<number | null>(
    defaultMarginPercent,
  );
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await updateDefaultMarkupAction({ percent: percent ?? 0 });
    setSaving(false);
    if (result.ok) {
      toast.success("Margem padrão salva");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="percent">
          Margem padrão (%)
          <InfoButton
            title="Markup padrão"
            detail={"Markup é a porcentagem de lucro que você quer ter sobre o preço de custo dos produtos.\n\nExemplo: se um produto custa R$ 10 e você quer 50% de markup, o preço de venda sugerido será R$ 15.\n\nEsse valor é usado como padrão ao cadastrar novos produtos, mas você pode alterar produto a produto."}
          />
        </Label>
        <PercentInput id="percent" value={percent} onChange={setPercent} />
        <p className="text-sm text-muted-foreground">
          Pré-preenche o campo de margem em cada novo produto.
        </p>
      </div>
      <HelpTip text="Salva o markup padrão para novos produtos">
        <Button type="submit" disabled={saving} className="w-fit">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </HelpTip>
    </form>
  );
}
