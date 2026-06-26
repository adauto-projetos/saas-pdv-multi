"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addCalendarMonths } from "@/lib/format/calendar-month";

interface ReleaseDialogProps {
  tenant: { id: string; name: string; validUntil: Date | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (months: number) => void;
  isPending?: boolean;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function ReleaseDialog({
  tenant,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ReleaseDialogProps) {
  // RF01: campo numérico pré-preenchido com 1.
  const [months, setMonths] = useState<number>(1);

  // RN01: guard real (o <input type=number> aceita digitação fora do range).
  const isValid = Number.isInteger(months) && months >= 1 && months <= 24;

  // RF02/RN02/RN03: preview ao vivo via o MESMO util do servidor.
  const now = new Date();
  const base =
    tenant.validUntil && tenant.validUntil > now ? tenant.validUntil : now;
  const newValidUntil = isValid ? addCalendarMonths(base, months) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar meses</DialogTitle>
          <DialogDescription>
            Confirma a liberação de acesso para <strong>{tenant.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="release-months" style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
            Quantidade de meses
          </label>
          <input
            id="release-months"
            type="number"
            min={1}
            max={24}
            step={1}
            value={Number.isNaN(months) ? "" : months}
            onChange={(e) => setMonths(e.target.valueAsNumber)}
            disabled={isPending}
            aria-label="Quantidade de meses a liberar"
            style={{
              width: 96,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
            }}
          />
          {!isValid && (
            <span style={{ fontSize: 12.5, color: "#b91c1c" }}>
              Informe um número inteiro entre 1 e 24 meses.
            </span>
          )}
        </div>

        {newValidUntil && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: "12px 14px",
              fontSize: 13.5,
              color: "#15803d",
            }}
          >
            Novo vencimento: <strong>{formatDate(newValidUntil)}</strong>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(months)} disabled={isPending || !isValid}>
            {isPending ? "Liberando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
