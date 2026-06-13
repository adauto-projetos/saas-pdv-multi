"use client";

import * as React from "react";

import type { ComandaDto } from "@/types/comanda";

import { ComandaCard } from "./ComandaCard";
import { ComandaHistory } from "./ComandaHistory";
import { OpenComandaDialog } from "./OpenComandaDialog";

/**
 * RF08 — tela principal de comandas: grade de abertas + histórico.
 * selectedId controla qual card está expandido (mostra item panel inline).
 */
export function ComandasScreen({
  openComandas,
}: {
  openComandas: ComandaDto[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  function handleToggleExpand(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Comandas</h1>
        <OpenComandaDialog />
      </div>

      <section className="grid gap-3">
        <h2 className="font-medium">Abertas</h2>
        {openComandas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma comanda aberta.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {openComandas.map((comanda) => (
              <ComandaCard
                key={comanda.id}
                comanda={comanda}
                expanded={selectedId === comanda.id}
                onToggleExpand={() => handleToggleExpand(comanda.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Histórico</h2>
        <ComandaHistory />
      </section>
    </div>
  );
}
