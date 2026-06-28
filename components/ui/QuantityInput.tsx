"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import type { ProductUnit } from "@/types/product";

type QuantityInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "step"
> & {
  value: number;
  onChange: (quantity: number) => void;
  unit: ProductUnit;
};

/** Estoque: step inteiro para `un`, 0,001 (grama) para `kg`. */
export function QuantityInput({
  value,
  onChange,
  unit,
  ...props
}: QuantityInputProps) {
  // Texto interno para permitir o campo VAZIO enquanto o usuário edita (apagar o
  // "0" sem ele voltar na hora). O valor numérico reportado ao parent é 0 quando
  // vazio; o display só não é forçado de volta a "0".
  const [text, setText] = React.useState(
    Number.isNaN(value) || value === 0 ? "" : String(value),
  );
  const [prevValue, setPrevValue] = React.useState(value);

  // Reconciliação na renderização (padrão React para derivar state de prop, sem
  // useEffect): quando o valor EXTERNO muda de fato (ex.: reset do form) e diverge
  // do que o texto já representa, ressincroniza. Não sobrescreve a edição em curso.
  if (value !== prevValue) {
    setPrevValue(value);
    const current = text.trim() === "" ? 0 : Number(text);
    if (current !== value) {
      setText(Number.isNaN(value) || value === 0 ? "" : String(value));
    }
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={unit === "kg" ? 0.001 : 1}
      className="text-base"
      placeholder="0"
      {...props}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(next.trim() === "" ? 0 : Number(next));
      }}
    />
  );
}
