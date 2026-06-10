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

  async function onSubmit(input: CreateProductInput) {
    const result = await createProductAction(input);
    if (result.ok) {
      toast.success("Produto salvo");
      router.push("/products");
    }
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
