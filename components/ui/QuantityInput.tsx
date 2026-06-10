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
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={unit === "kg" ? 0.001 : 1}
      className="text-base"
      {...props}
      value={Number.isNaN(value) ? "" : value}
      onChange={(e) =>
        onChange(e.target.value === "" ? 0 : Number(e.target.value))
      }
    />
  );
}
