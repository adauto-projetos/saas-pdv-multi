"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import type { z } from "zod";

import { MarkupCalculatorFields } from "@/components/products/MarkupCalculatorFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { calculateSalePrice } from "@/lib/services/products/markup";
import type { ActionResult } from "@/lib/services/errors";
import { createProductSchema } from "@/lib/validation/product";
import type { CreateProductInput } from "@/lib/validation/product";
import type { ProductDto, ProductUnit } from "@/types/product";

type ProductFormProps = {
  mode: "create" | "edit";
  /** Margem padrão da loja para pré-preencher novos cadastros (RF05). */
  defaultMarkupPercent: number;
  defaultValues?: ProductDto;
  /** Sucesso (toast/redirect/RF06) é responsabilidade de quem chama. */
  onSubmit: (input: CreateProductInput) => Promise<ActionResult<ProductDto>>;
};

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function ProductForm({
  mode,
  defaultMarkupPercent,
  defaultValues,
  onSubmit,
}: ProductFormProps) {
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [barcode, setBarcode] = React.useState(defaultValues?.barcode ?? "");
  const [unit, setUnit] = React.useState<ProductUnit>(
    defaultValues?.unit ?? "un",
  );
  const [stockQuantity, setStockQuantity] = React.useState<number>(
    defaultValues?.stockQuantity ?? 0,
  );
  const [costCents, setCostCents] = React.useState<number | null>(
    defaultValues?.costCents ?? null,
  );
  const [markupPercent, setMarkupPercent] = React.useState<number | null>(
    defaultValues?.markupPercent ??
      (mode === "create" ? defaultMarkupPercent : null),
  );
  const [manualPrice, setManualPrice] = React.useState<number | null>(
    defaultValues?.priceIsManual ? (defaultValues.salePriceCents ?? null) : null,
  );
  const [minStock, setMinStock] = React.useState<number | null>(
    defaultValues?.minStock ?? null,
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [submitting, setSubmitting] = React.useState(false);

  const priceIsManual = manualPrice !== null;
  const computedPriceCents = priceIsManual
    ? manualPrice
    : costCents != null
      ? calculateSalePrice(costCents, markupPercent ?? 0)
      : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    const input = {
      name,
      barcode: barcode.trim() === "" ? undefined : barcode.trim(),
      unit,
      stockQuantity,
      minStock: minStock ?? undefined,
      costCents: costCents ?? undefined,
      markupPercent: markupPercent ?? undefined,
      // Só envia salePrice quando é override manual (RF03/RF04); senão o backend calcula.
      salePriceCents: priceIsManual ? (manualPrice ?? undefined) : undefined,
    };

    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    const result = await onSubmit(parsed.data);
    setSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 pb-24">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          className="text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldErrors.name ? (
          <p className="text-sm text-destructive">{fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="barcode">Código de barras</Label>
          <Input
            id="barcode"
            className="text-base"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Opcional"
          />
          {fieldErrors.barcode ? (
            <p className="text-sm text-destructive">{fieldErrors.barcode}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Unidade</Label>
          <select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="un">Unidade (un)</option>
            <option value="kg">Peso (kg)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="stock">Estoque inicial</Label>
          <QuantityInput
            id="stock"
            value={stockQuantity}
            onChange={setStockQuantity}
            unit={unit}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="minStock">Estoque mínimo (alerta)</Label>
          <Input
            id="minStock"
            type="number"
            inputMode="decimal"
            min={0}
            step={unit === "kg" ? 0.001 : 1}
            className="text-base"
            placeholder="Opcional"
            value={minStock ?? ""}
            onChange={(e) =>
              setMinStock(e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </div>
      </div>

      <MarkupCalculatorFields
        costCents={costCents}
        markupPercent={markupPercent}
        computedPriceCents={computedPriceCents}
        priceIsManual={priceIsManual}
        onCostChange={setCostCents}
        onMarkupChange={setMarkupPercent}
        onPriceChange={setManualPrice}
        onResetManual={() => setManualPrice(null)}
      />
      {fieldErrors.salePriceCents ? (
        <p className="text-sm text-destructive">{fieldErrors.salePriceCents}</p>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Dica:{" "}
        <Link href="/settings" className="text-primary hover:underline">
          configurar margem padrão
        </Link>{" "}
        para pré-preencher novos produtos.
      </p>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto flex w-full max-w-5xl justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Salvando..."
              : mode === "create"
                ? "Salvar produto"
                : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
}
