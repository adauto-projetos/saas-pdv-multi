"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { brlToCents, centsToBRL } from "@/lib/format/money";

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number | null;
  onChange: (cents: number | null) => void;
};

/** Input de dinheiro: digita em BRL, emite centavos inteiros. */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  const [text, setText] = React.useState(
    value != null ? centsToBRL(value) : "",
  );

  return (
    <Input
      inputMode="decimal"
      className="text-base"
      {...props}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onChange(raw.trim() === "" ? null : brlToCents(raw));
      }}
      onBlur={(e) => {
        setText(value != null ? centsToBRL(value) : "");
        props.onBlur?.(e);
      }}
    />
  );
}
