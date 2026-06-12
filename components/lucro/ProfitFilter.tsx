"use client";

import * as React from "react";

import { getProfitAction } from "@/app/(app)/lucro/actions";
import { ProfitSummaryCard } from "@/components/lucro/ProfitSummaryCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="profit-from">De</Label>
          <Input
            id="profit-from"
            type="date"
            className="w-40 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="profit-to">Até</Label>
          <Input
            id="profit-to"
            type="date"
            className="w-40 text-base"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className={loading ? "opacity-60" : undefined}>
        <ProfitSummaryCard profit={profit} />
      </div>
    </div>
  );
}
