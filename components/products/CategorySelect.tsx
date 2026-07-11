"use client";

import * as React from "react";
import { toast } from "sonner";

import { createProductCategoryAction } from "@/app/(app)/products/categories/actions";
import { CategoryFormDialog } from "@/components/products/CategoryFormDialog";
import type { CreateProductCategoryInput } from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

/** Sentinela da opção "+ Nova categoria" — nunca vira valor do formulário. */
const NEW_CATEGORY_OPTION = "__new__";

type CategorySelectProps = {
  /** Categorias do tenant, ordenadas por `position` (RF06/RF07). */
  categories: ProductCategoryDto[];
  /** id da categoria selecionada; `null` = Sem categoria (RN04). */
  value: string | null;
  /** `null` quando o usuário escolhe "Sem categoria" — o submit envia `categoryId: null`. */
  onChange: (categoryId: string | null) => void;
  id?: string;
};

/**
 * Select nativo de categoria (RF04/RF07): lista as categorias do tenant por
 * `position` + opção "+ Nova categoria" que abre o CategoryFormDialog para
 * criação inline sem sair do fluxo de cadastro. A recém-criada é appendada à
 * lista local e selecionada (sem refetch — o service já a coloca no fim da
 * ordem). Preserva o contrato visual 0023H do select do ProductForm
 * (bg-background, h-9, focus-visible ring).
 */
export function CategorySelect({
  categories,
  value,
  onChange,
  id,
}: CategorySelectProps) {
  const [localCategories, setLocalCategories] = React.useState<
    ProductCategoryDto[]
  >(() => [...categories].sort((a, b) => a.position - b.position));
  const [dialogOpen, setDialogOpen] = React.useState(false);

  function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const selected = event.target.value;
    if (selected === NEW_CATEGORY_OPTION) {
      // Select controlado: sem onChange, o valor anterior permanece.
      setDialogOpen(true);
      return;
    }
    onChange(selected === "" ? null : selected);
  }

  async function handleCreate(input: CreateProductCategoryInput) {
    const result = await createProductCategoryAction(input);
    if (result.ok) {
      // O service grava position = max+1, então o append preserva a ordem (RF04/RF06).
      setLocalCategories((prev) => [...prev, result.data]);
      onChange(result.data.id);
      toast.success("Categoria criada");
    }
    return result;
  }

  return (
    <>
      <select
        id={id}
        value={value ?? ""}
        onChange={handleSelectChange}
        className="h-9 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Sem categoria</option>
        {localCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
        <option value={NEW_CATEGORY_OPTION}>+ Nova categoria</option>
      </select>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </>
  );
}
