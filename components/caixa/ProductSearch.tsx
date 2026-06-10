"use client";

import * as React from "react";

import { searchProductsAction } from "@/app/(app)/caixa/actions";
import { Input } from "@/components/ui/input";
import { centsToBRL } from "@/lib/format/money";
import type { ProductDto } from "@/types/product";

/** Busca produto por nome (RF02) — granel/itens sem código. */
export function ProductSearch({
  onSelect,
}: {
  onSelect: (product: ProductDto) => void;
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
      if (!active) return;
      // Em erro, limpa em vez de manter resultados velhos na tela (COR-03).
      setResults(res.ok ? res.data : []);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-label="Buscar produto por nome"
        aria-expanded={results.length > 0}
        aria-controls="product-search-results"
        aria-haspopup="listbox"
        className="text-base"
        placeholder="Buscar produto por nome..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 ? (
        <ul
          id="product-search-results"
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
                <span className="font-mono text-muted-foreground">
                  {centsToBRL(product.salePriceCents)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
