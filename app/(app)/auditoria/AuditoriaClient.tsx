"use client";

import * as React from "react";
import { toast } from "sonner";

import { getAuditAction } from "@/app/(app)/auditoria/actions";
import { InfoButton } from "@/components/ui/help-tip";
import { PageCard } from "@/components/ui/PageCard";
import { centsToBRL } from "@/lib/format/money";
import type { AuditReportDto } from "@/types/audit";

const ACTION_LABELS: Record<string, string> = {
  cancelar_comanda: "Cancelar comanda",
  remover_item_comanda: "Remover item",
  fechar_caixa: "Fechar caixa",
};

const inputStyle: React.CSSProperties = {
  height: 38,
  padding: "0 10px",
  borderRadius: 9,
  border: "1.5px solid #e2e8f0",
  fontSize: 13.5,
};

function startOfTodayISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function AuditoriaClient({ initial }: { initial: AuditReportDto }) {
  const [report, setReport] = React.useState(initial);
  const [operatorId, setOperatorId] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  async function applyFilter(next: {
    operatorId?: string;
    from?: string;
    to?: string;
  }) {
    setLoading(true);
    const result = await getAuditAction({
      operatorId: next.operatorId || undefined,
      from: next.from || undefined,
      to: next.to || undefined,
    });
    setLoading(false);
    if (result.ok) setReport(result.data);
    else toast.error(result.error);
  }

  function handleApply() {
    void applyFilter({ operatorId, from, to });
  }

  function handleToday() {
    const today = startOfTodayISO();
    setFrom(today);
    setTo("");
    void applyFilter({ operatorId, from: today, to: "" });
  }

  function handleClear() {
    setOperatorId("");
    setFrom("");
    setTo("");
    void applyFilter({});
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <PageCard>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="flex items-center text-[11px] font-semibold text-gray-400">
              Operador
              <InfoButton
                title="Filtrar a auditoria"
                detail="Escolha um operador (ou 'Todos') e um período (De/Até) para ver o que cada um fez. O botão 'Hoje' filtra só o dia atual e 'Limpar' remove os filtros. Depois clique em 'Aplicar'."
              />
            </label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              style={{ ...inputStyle, minWidth: 180 }}
            >
              <option value="">Todos</option>
              {report.operators.map((o) => (
                <option key={o.userId} value={o.userId}>
                  {o.name ?? o.email}
                  {o.isOwner ? " (Dono)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400">De</label>
            <input
              type="date"
              value={from ? from.slice(0, 10) : ""}
              onChange={(e) =>
                setFrom(e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400">Até</label>
            <input
              type="date"
              value={to ? to.slice(0, 10) : ""}
              onChange={(e) =>
                setTo(e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              style={inputStyle}
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white"
          >
            {loading ? "..." : "Aplicar"}
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-700"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-500"
          >
            Limpar
          </button>
        </div>
      </PageCard>

      {/* Tabela por operador */}
      <PageCard>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">
                  <span className="inline-flex items-center">
                    Operador
                    <InfoButton
                      title="Como ler a tabela"
                      detail="Cada linha é um operador. Vendas = nº de vendas; Σ Vendas = total faturado por ele; Caixa abre/fecha = quantas vezes abriu e fechou o caixa; Comandas (A/F/C) = Abertas / Fechadas / Canceladas; Estoque = nº de movimentações de estoque; Caixa mov. = lançamentos manuais de dinheiro (suprimento/sangria)."
                    />
                  </span>
                </th>
                <th className="px-3 py-3">Vendas</th>
                <th className="px-3 py-3">Σ Vendas</th>
                <th className="px-3 py-3">Caixa abre/fecha</th>
                <th className="px-3 py-3">Comandas (A/F/C)</th>
                <th className="px-3 py-3">Estoque</th>
                <th className="px-3 py-3">Caixa mov.</th>
              </tr>
            </thead>
            <tbody>
              {report.operators.map((o) => (
                <tr key={o.userId} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">
                      {o.name ?? o.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      {o.isOwner ? "Dono" : "Operador"}
                      {!o.isActive && (
                        <span className="rounded bg-gray-100 px-1.5 font-bold text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">{o.salesCount}</td>
                  <td className="px-3 py-3 font-mono text-green-600">
                    {centsToBRL(o.salesTotalCents)}
                  </td>
                  <td className="px-3 py-3">
                    {o.cashOpened} / {o.cashClosed}
                  </td>
                  <td className="px-3 py-3">
                    {o.comandasOpened} / {o.comandasClosed} / {o.comandasCancelled}
                  </td>
                  <td className="px-3 py-3">{o.stockMovements}</td>
                  <td className="px-3 py-3">{o.cashMovements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Seção de overrides — só quando override_log existe (SF02) */}
      {report.overrides !== null && (
        <PageCard>
          <div
            className="px-5 py-4 border-b border-gray-100"
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: 16,
              color: "#0f172a",
            }}
          >
            Ações liberadas por administrador ({report.overrides.length})
          </div>
          {report.overrides.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">
              Nenhuma liberação no período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-3 py-3">Ação</th>
                    <th className="px-3 py-3">Operador</th>
                    <th className="px-3 py-3">Autorizado por</th>
                  </tr>
                </thead>
                <tbody>
                  {report.overrides.map((ov, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(ov.createdAt).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        {ACTION_LABELS[ov.actionCode] ?? ov.actionCode}
                      </td>
                      <td className="px-3 py-3">{ov.actorName}</td>
                      <td className="px-3 py-3">{ov.authorizerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageCard>
      )}
    </div>
  );
}
