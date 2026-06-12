"use client";

import * as React from "react";

import { listCustomersAction } from "@/app/(app)/financeiro/customers/actions";
import { Input } from "@/components/ui/input";
import type { CustomerDto } from "@/types/finance";

/**
 * Combobox de busca de cliente por nome (RF07/RF08). Reusado pelo formulário de
 * conta a receber avulsa e pelo checkout fiado. Espelha ProductSearch.
 */
export function CustomerPicker({
  value,
  onSelect,
  inputId,
}: {
  value: CustomerDto | null;
  onSelect: (customer: CustomerDto | null) => void;
  inputId?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CustomerDto[]>([]);

  React.useEffect(() => {
    const q = query.trim();
    let active = true;
    const timer = setTimeout(async () => {
      if (!q) {
        if (active) setResults([]);
        return;
      }
      const res = await listCustomersAction({ search: q });
      if (!active) return;
      setResults(res.ok ? res.data : []);
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <span className="text-sm">
          <span className="font-medium">{value.name}</span>
          {value.phone ? (
            <span className="text-muted-foreground"> · {value.phone}</span>
          ) : null}
        </span>
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={inputId}
        role="combobox"
        aria-label="Buscar cliente por nome"
        aria-expanded={results.length > 0}
        aria-controls="customer-picker-results"
        aria-haspopup="listbox"
        className="text-base"
        placeholder="Buscar cliente por nome..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && results.length === 0 ? (
        <p
          id="customer-picker-results"
          className="absolute z-10 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md"
        >
          Nenhum cliente encontrado.
        </p>
      ) : null}
      {results.length > 0 ? (
        <ul
          id="customer-picker-results"
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {results.map((customer) => (
            <li key={customer.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(customer);
                  setQuery("");
                  setResults([]);
                }}
              >
                <span>{customer.name}</span>
                <span className="font-mono text-muted-foreground">
                  {customer.phone ?? ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
