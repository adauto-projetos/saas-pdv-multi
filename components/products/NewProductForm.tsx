"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createProductAction } from "@/app/(app)/products/actions";
import { ProductForm } from "@/components/products/ProductForm";
import type { CreateProductInput } from "@/lib/validation/product";

export function NewProductForm({
  defaultMarkupPercent,
}: {
  defaultMarkupPercent: number;
}) {
  const router = useRouter();

  async function onSubmit(input: CreateProductInput, stagedImage: File | null) {
    const result = await createProductAction(input);
    if (!result.ok) return result;

    // RF01/RF08: o endpoint de upload precisa do id, que só existe após o create.
    // Falha de foto NÃO bloqueia o cadastro — avisa e segue com o redirect.
    if (stagedImage) {
      try {
        const body = new FormData();
        body.append("file", stagedImage);
        const res = await fetch(`/api/products/${result.data.id}/upload`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          toast.warning(
            "Produto salvo, mas a foto não pôde ser enviada. Tente de novo na edição.",
          );
        }
      } catch {
        toast.warning(
          "Produto salvo, mas a foto não pôde ser enviada. Tente de novo na edição.",
        );
      }
    }

    toast.success("Produto salvo");
    router.push("/products");
    return result;
  }

  return (
    <ProductForm
      mode="create"
      defaultMarkupPercent={defaultMarkupPercent}
      onSubmit={onSubmit}
    />
  );
}
