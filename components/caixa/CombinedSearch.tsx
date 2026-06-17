"use client";

import * as React from "react";

import { searchProductsAction } from "@/app/(app)/caixa/actions";
import { centsToBRL } from "@/lib/format/money";
import type { ProductDto } from "@/types/product";

interface CombinedSearchProps {
  onSelect: (product: ProductDto, qty: number) => void;
  onBarcode: (code: string, qty: number) => void;
  disabled?: boolean;
}

/**
 * QTD pill + campo unificado de busca por nome / código de barras.
 * Enter sem resultados → trata como barcode. Enter com resultados → adiciona
 * o 1º match com a quantidade digitada. Click no dropdown → idem.
 */
export function CombinedSearch({
  onSelect,
  onBarcode,
  disabled,
}: CombinedSearchProps) {
  const [qty, setQty] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ProductDto[]>([]);
  const searchRef = React.useRef<HTMLInputElement>(null);

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
      setResults(res.ok ? res.data : []);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = query.trim();
    if (!code) return;

    if (results.length > 0) {
      onSelect(results[0], qty);
    } else {
      onBarcode(code, qty);
    }
    setQuery("");
    setResults([]);
    setQty(1);
    searchRef.current?.focus();
  }

  function handlePick(product: ProductDto) {
    onSelect(product, qty);
    setQuery("");
    setResults([]);
    setQty(1);
    searchRef.current?.focus();
  }

  return (
    <div className="flex h-[42px] gap-2.5">
      {/* QTD pill */}
      <div className="flex shrink-0 items-center gap-2 rounded-[9px] border border-gray-200 bg-white px-3.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-gray-400">
          Qtd.
        </span>
        <input
          type="number"
          min="0.001"
          step="any"
          value={qty}
          onChange={(e) => setQty(Math.max(0.001, Number(e.target.value) || 1))}
          className="w-10 bg-transparent text-center text-[18px] font-bold text-green-600 outline-none"
          aria-label="Quantidade"
        />
      </div>

      {/* Search input */}
      <div className="relative flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchRef}
          autoFocus
          data-testid="barcode-input"
          aria-label="Código de barras ou nome do produto"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Código de barras ou nome — pressione Enter para adicionar..."
          className="h-full w-full rounded-[9px] border border-gray-200 bg-white pl-9 pr-3.5 text-[13px] outline-none focus:border-gray-400"
        />

        {/* Dropdown */}
        {query && results.length > 0 ? (
          <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[300px] overflow-y-auto rounded-[10px] border border-gray-200 bg-white shadow-lg">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between border-b border-gray-50 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50"
                  onClick={() => handlePick(p)}
                >
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">
                      {p.name}
                    </div>
                    <div
                      className={[
                        "mt-0.5 text-[10px] font-medium",
                        p.stockQuantity === 0
                          ? "text-red-500"
                          : "text-gray-400",
                      ].join(" ")}
                    >
                      {p.stockQuantity === 0
                        ? "Sem estoque"
                        : `Est: ${p.stockQuantity}`}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 text-[15px] font-bold text-green-600">
                    {centsToBRL(p.salePriceCents)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
