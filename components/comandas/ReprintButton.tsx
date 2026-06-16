"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  reprintKitchenAction,
  reprintReceiptAction,
} from "@/app/(app)/comandas/print-actions";
import { Button } from "@/components/ui/button";

/**
 * RF-Print — botão de reimpressão de via de cozinha ou cupom fiscal.
 * Operação idempotente: nenhum AlertDialog de confirmação necessário.
 * Sem router.refresh() — impressão é efeito colateral puro sem impacto em cache.
 */
export function ReprintButton({
  type,
  id,
}: {
  type: "cozinha" | "cupom";
  id: string;
}) {
  const [pending, setPending] = React.useState(false);

  async function handleReprint() {
    setPending(true);
    const res =
      type === "cozinha"
        ? await reprintKitchenAction({ comandaItemId: id })
        : await reprintReceiptAction({ saleId: id });
    setPending(false);

    if (res.ok) {
      toast.success(
        type === "cozinha" ? "Via de cozinha reimpressa" : "Cupom reimpresso",
      );
      if (res.printWarning) toast.warning(res.printWarning);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={
        type === "cozinha" ? "Reimprimir cozinha" : "Reimprimir cupom"
      }
      disabled={pending}
      onClick={handleReprint}
    >
      {type === "cozinha" ? "Reimprimir via" : "Reimprimir cupom"}
    </Button>
  );
}
