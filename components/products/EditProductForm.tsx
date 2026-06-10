"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  applyCostChangeAction,
  previewPriceOnCostChangeAction,
  updateProductAction,
} from "@/app/(app)/products/actions";
import { PriceSuggestionDialog } from "@/components/products/PriceSuggestionDialog";
import { ProductForm } from "@/components/products/ProductForm";
import type { ActionResult } from "@/lib/services/errors";
import type { CreateProductInput } from "@/lib/validation/product";
import type { PriceSuggestionDto, ProductDto } from "@/types/product";

export function EditProductForm({ product }: { product: ProductDto }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<PriceSuggestionDto | null>(
    null,
  );
  const [pendingCost, setPendingCost] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(
    input: CreateProductInput,
  ): Promise<ActionResult<ProductDto>> {
    const costChanged =
      (input.costCents ?? null) !== (product.costCents ?? null);

    // RF06: custo mudou e há margem armazenada -> preview + diálogo de confirmação.
    if (
      costChanged &&
      input.costCents != null &&
      product.markupPercent != null
    ) {
      const preview = await previewPriceOnCostChangeAction({
        id: product.id,
        newCostCents: input.costCents,
      });
      if (preview.ok) {
        setSuggestion(preview.data);
        setPendingCost(input.costCents);
        setDialogOpen(true);
        return { ok: true, data: product }; // sucesso "neutro": diálogo assume o fluxo
      }
      return preview;
    }

    const result = await updateProductAction({ ...input, id: product.id });
    if (result.ok) {
      toast.success("Produto atualizado");
      router.push("/products");
    }
    return result;
  }

  async function handleApply(accept: boolean) {
    if (pendingCost == null) return;
    setSubmitting(true);
    const result = await applyCostChangeAction({
      id: product.id,
      newCostCents: pendingCost,
      acceptSuggestion: accept,
    });
    setSubmitting(false);
    setDialogOpen(false);
    if (result.ok) {
      toast.success(
        accept ? "Preço atualizado" : "Custo atualizado, preço mantido",
      );
      router.push("/products");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <ProductForm
        mode="edit"
        defaultMarkupPercent={product.markupPercent ?? 0}
        defaultValues={product}
        onSubmit={onSubmit}
      />
      {suggestion ? (
        <PriceSuggestionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          suggestion={suggestion}
          onConfirm={() => handleApply(true)}
          onCancel={() => handleApply(false)}
          isSubmitting={submitting}
        />
      ) : null}
    </>
  );
}
