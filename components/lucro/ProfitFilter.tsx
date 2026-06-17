"use client";

import * as React from "react";

import { getProfitAction } from "@/app/(app)/lucro/actions";
import { ProfitSummaryCard } from "@/components/lucro/ProfitSummaryCard";
import { PageCard, PageCardHeader } from "@/components/ui/PageCard";
import type { ProfitDto } from "@/types/profit";

/**
 * RF02/RF03 — filtro de período do lucro (padrão hoje). O 1º paint usa o
 * `initial` ProfitDto vindo do servidor (page RSC); ao mudar o filtro,
 * recarrega via `getProfitAction` (mirror CashStatement, active-flag cleanup).
 */
export function ProfitFilter({ initial }: { initial: ProfitDto }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [profit, setProfit] = React.useState<ProfitDto>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Pula o fetch no 1º render: `initial` já veio do servidor.
  const isFirst = React.useRef(true);

  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await getProfitAction({
        from: from || undefined,
        // inclui o dia inteiro do "até".
        to: to ? `${to}T23:59:59` : undefined,
      });
      if (!active) return;
      if (res.ok) {
        setProfit(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [from, to]);

  return (
    <div className="flex flex-col gap-5">
      <PageCard>
        <PageCardHeader>Período de análise</PageCardHeader>
        <div className="flex flex-wrap items-end gap-3 p-5">
          {(["De", "Até"] as const).map((label) => (
            <div key={label} className="grid gap-1">
              <label className="text-[11px] font-semibold text-gray-400">
                {label}
              </label>
              <input
                type="date"
                className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-gray-400"
                value={label === "De" ? from : to}
                onChange={(e) =>
                  label === "De" ? setFrom(e.target.value) : setTo(e.target.value)
                }
              />
            </div>
          ))}
          <button
            onClick={() => {
              setFrom(from);
              setTo(to);
            }}
            className="rounded-lg bg-green-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-green-700"
          >
            Filtrar
          </button>
        </div>
      </PageCard>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className={loading ? "opacity-60" : undefined}>
        <ProfitSummaryCard profit={profit} />
      </div>
    </div>
  );
}
