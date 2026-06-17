"use client";

import * as React from "react";

import { PageCard } from "@/components/ui/PageCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { ComandaDto } from "@/types/comanda";

import { ComandaCard } from "./ComandaCard";
import { ComandaHistory } from "./ComandaHistory";

/**
 * RF08 — tela principal de comandas: grade de abertas + histórico.
 * selectedId controla qual card está expandido (mostra item panel inline).
 * O botão "Abrir comanda" foi movido para AppTopBar (OD-1).
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
    <div className="flex flex-col gap-5 px-7 py-6">
      <div>
        <SectionLabel className="mb-3">Abertas</SectionLabel>
        {openComandas.length === 0 ? (
          <PageCard>
            <p className="px-5 py-10 text-center text-sm text-gray-400">
              Nenhuma comanda aberta. Use o botão acima para abrir uma.
            </p>
          </PageCard>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}
          >
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
      </div>

      <div>
        <SectionLabel className="mb-3">Histórico</SectionLabel>
        <PageCard>
          <div className="p-5">
            <ComandaHistory />
          </div>
        </PageCard>
      </div>
    </div>
  );
}
