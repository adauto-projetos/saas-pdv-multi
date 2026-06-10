"use client";

import * as React from "react";

import { searchProductsAction } from "@/app/(app)/caixa/actions";
import { Input } from "@/components/ui/input";
import type { ProductDto } from "@/types/product";

/** Seleção de produto por busca (reusa a busca do caixa). */
export function ProductPicker({
  value,
  onSelect,
  id = "product-search",
}: {
  value: ProductDto | null;
  onSelect: (product: ProductDto | null) => void;
  id?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ProductDto[]>([]);

  React.useEffect(() => {
    const q = query.trim();
    let active = true;
    const timer = setTimeout(async () => {
      if (!q) {
        if (active) setResults([]);
        return;
      }
      const res = await searchProductsAction(q);
      if (active) setResults(res.ok ? res.data : []);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span className="font-medium">{value.name}</span>
        <button
          type="button"
          aria-label={`Trocar produto: ${value.name}`}
          className="text-primary hover:underline"
          onClick={() => onSelect(null)}
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-label="Buscar produto"
        aria-expanded={results.length > 0}
        aria-controls="product-picker-results"
        aria-haspopup="listbox"
        placeholder="Buscar produto por nome..."
        className="text-base"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 ? (
        <ul
          id="product-picker-results"
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {results.map((product) => (
            <li key={product.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(product);
                  setQuery("");
                  setResults([]);
                }}
              >
                <span>{product.name}</span>
                <span className="text-muted-foreground">
                  estoque {product.stockQuantity}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
