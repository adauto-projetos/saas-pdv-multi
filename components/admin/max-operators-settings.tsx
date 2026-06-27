"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateMaxOperatorsAction } from "@/app/(admin)/superadmin/actions";

interface MaxOperatorsSettingsProps {
  initialMaxOperators: number;
}

/**
 * Card do painel super admin para o founder definir o teto global de operadores
 * por loja (0014F/SF03). Espelha PlanPriceSettings. Edita via
 * updateMaxOperatorsAction (gated por requireFounder). Grandfather: baixar o teto
 * não desativa ninguém — só barra novos cadastros.
 */
export function MaxOperatorsSettings({
  initialMaxOperators,
}: MaxOperatorsSettingsProps) {
  const [value, setValue] = useState<number>(initialMaxOperators);
  const [savedValue, setSavedValue] = useState<number>(initialMaxOperators);
  const [isPending, startTransition] = useTransition();

  const isValid = Number.isInteger(value) && value >= 1;
  const isDirty = isValid && value !== savedValue;

  function handleSave() {
    if (!isValid) return;
    startTransition(async () => {
      const result = await updateMaxOperatorsAction(value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedValue(result.data.maxOperators);
      toast.success("Limite de operadores atualizado.");
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
        Limite de operadores por loja
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        Máximo de operadores ativos que cada loja pode cadastrar (o dono não
        conta). Atual: <strong>{savedValue}</strong>. Reduzir não desativa
        operadores já existentes.
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="max-operators"
            style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}
          >
            Operadores por loja
          </label>
          <input
            id="max-operators"
            type="number"
            min={1}
            max={1000}
            value={value}
            disabled={isPending}
            onChange={(e) => setValue(Math.floor(Number(e.target.value)))}
            aria-label="Limite de operadores por loja"
            style={{
              width: 160,
              height: 42,
              padding: "0 12px",
              borderRadius: 10,
              border: "1.5px solid #e2e8f0",
              fontSize: 14,
            }}
          />
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
