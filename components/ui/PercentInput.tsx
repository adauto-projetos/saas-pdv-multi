"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatPercent, parsePercent } from "@/lib/format/percent";

type PercentInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number | null;
  onChange: (percent: number | null) => void;
};

/** Input de percentual de margem (0–999,99). Emite number. */
export function PercentInput({ value, onChange, ...props }: PercentInputProps) {
  const [text, setText] = React.useState(
    value != null ? formatPercent(value) : "",
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
        onChange(raw.trim() === "" ? null : parsePercent(raw));
      }}
      onBlur={(e) => {
        setText(value != null ? formatPercent(value) : "");
        props.onBlur?.(e);
      }}
    />
  );
}
