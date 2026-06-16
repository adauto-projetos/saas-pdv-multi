"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { addComandaItemAction } from "@/app/(app)/comandas/actions";
import { lookupProductByBarcodeAction } from "@/app/(app)/caixa/actions";
import { BarcodeInput } from "@/components/caixa/BarcodeInput";
import { ProductSearch } from "@/components/caixa/ProductSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuantityInput } from "@/components/ui/QuantityInput";
import type { ProductDto } from "@/types/product";

/**
 * RF02 — lança item na comanda: produto (código de barras ou busca) +
 * quantidade + observação opcional. Baixa estoque no lançamento (RN03).
 * Mirrors components/caixa/ item search pattern.
 */
export function AddItemForm({ comandaId }: { comandaId: string }) {
  const router = useRouter();
  const [product, setProduct] = React.useState<ProductDto | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [observation, setObservation] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

  async function handleBarcode(code: string) {
    setLookingUp(true);
    try {
      const res = await lookupProductByBarcodeAction(code);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.data) {
        toast.error("Produto não encontrado.");
        return;
      }
      setProduct(res.data);
      setQuantity(1);
    } catch {
      toast.error("Erro ao buscar o produto.");
    } finally {
      setLookingUp(false);
    }
  }

  function handleProductSelect(p: ProductDto) {
    setProduct(p);
    setQuantity(1);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!product) {
      toast.error("Selecione um produto.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    setSubmitting(true);
    const res = await addComandaItemAction({
      comandaId,
      productId: product.id,
      quantity,
      observation: observation.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${product.name} adicionado à comanda`);
    if (res.printWarning) toast.warning(res.printWarning);
    setProduct(null);
    setQuantity(1);
    setObservation("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-2">
        <Label>Código de barras</Label>
        <BarcodeInput onSubmit={handleBarcode} disabled={lookingUp} />
      </div>

      <div className="grid gap-2">
        <Label>Busca por nome</Label>
        <ProductSearch onSelect={handleProductSelect} />
      </div>

      {product ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{product.name}</span>
            <span className="ml-1 text-muted-foreground">({product.unit})</span>
          </span>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setProduct(null)}
          >
            Trocar
          </button>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="item-quantity">Quantidade</Label>
        <QuantityInput
          id="item-quantity"
          aria-label="Quantidade"
          value={quantity}
          unit={product?.unit ?? "un"}
          onChange={setQuantity}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="item-observation">Observação (opcional)</Label>
        <Input
          id="item-observation"
          className="text-base"
          placeholder="ex: sem cebola"
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={submitting || !product || quantity <= 0}
        className="w-fit"
      >
        {submitting ? "Adicionando..." : "Adicionar item"}
      </Button>
    </form>
  );
}
