"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

/**
 * Campo de código de barras: auto-focado, e o Enter adiciona e limpa, mantendo o
 * foco — para bipagem em sequência (RF01/RF10). O leitor de código atua como
 * teclado (digita + Enter).
 */
export function BarcodeInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (code: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState("");

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = value.trim();
    if (code) onSubmit(code);
    setValue("");
    event.currentTarget.focus();
  }

  return (
    <Input
      autoFocus
      data-testid="barcode-input"
      aria-label="Código de barras"
      className="text-base"
      placeholder="Bipe ou digite o código e tecle Enter"
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
