"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePlanPriceAction } from "@/app/(admin)/superadmin/actions";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { centsToBRL } from "@/lib/format/money";

interface PlanPriceSettingsProps {
  initialPriceCents: number;
}

/**
 * Card do painel super admin para o founder definir o preço do plano mensal.
 * O valor é exibido na tela de criar conta (signup). Edita a config global da
 * plataforma via updatePlanPriceAction (gated por requireFounder).
 */
export function PlanPriceSettings({ initialPriceCents }: PlanPriceSettingsProps) {
  const [priceCents, setPriceCents] = useState<number | null>(initialPriceCents);
  const [isPending, startTransition] = useTransition();

  // Valor de referência salvo (para mostrar o preço atual e habilitar o botão).
  const [savedCents, setSavedCents] = useState<number>(initialPriceCents);

  const isValid = priceCents !== null && Number.isInteger(priceCents) && priceCents >= 0;
  const isDirty = isValid && priceCents !== savedCents;

  function handleSave() {
    if (!isValid || priceCents === null) return;
    startTransition(async () => {
      const result = await updatePlanPriceAction(priceCents);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedCents(result.data.priceCents);
      toast.success("Preço do plano atualizado.");
    });
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eef1f5",
        borderRadius: 16,
        padding: "20px 22px",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
        Preço do plano mensal
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Exibido na tela de criar conta, depois dos 7 dias de teste grátis. Atual:{" "}
        <strong>{savedCents > 0 ? centsToBRL(savedCents) : "não definido"}</strong>.
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="plan-price"
            style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}
          >
            Valor por mês
          </label>
          <div style={{ width: 160 }}>
            <MoneyInput
              id="plan-price"
              value={priceCents}
              onChange={setPriceCents}
              disabled={isPending}
              aria-label="Preço do plano mensal"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !isDirty}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "none",
            background: isDirty ? "#15803d" : "#cbd5e1",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: isPending || !isDirty ? "default" : "pointer",
          }}
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
