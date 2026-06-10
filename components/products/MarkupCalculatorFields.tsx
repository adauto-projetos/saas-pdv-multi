"use client";

import { XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PercentInput } from "@/components/ui/PercentInput";
import { brlToCents, centsToBRL } from "@/lib/format/money";

type MarkupCalculatorFieldsProps = {
  costCents: number | null;
  markupPercent: number | null;
  /** Preço exibido/efetivo: manual quando priceIsManual, senão o calculado. */
  computedPriceCents: number | null;
  priceIsManual: boolean;
  onCostChange: (cents: number | null) => void;
  onMarkupChange: (percent: number | null) => void;
  onPriceChange: (cents: number | null) => void;
  onResetManual: () => void;
};

/**
 * Campo de preço de venda. Enquanto NÃO é manual, espelha o preço calculado ao vivo;
 * ao digitar, vira manual (RF03) e para de ser sobrescrito pelo cálculo.
 */
function SalePriceField({
  computedPriceCents,
  priceIsManual,
  onPriceChange,
}: Pick<
  MarkupCalculatorFieldsProps,
  "computedPriceCents" | "priceIsManual" | "onPriceChange"
>) {
  // `text` só vale quando manual (o usuário está digitando). Quando NÃO é manual,
  // o display é derivado do preço calculado durante o render — sem efeito/setState.
  const [text, setText] = React.useState(() =>
    priceIsManual && computedPriceCents != null
      ? centsToBRL(computedPriceCents)
      : "",
  );

  const displayValue = priceIsManual
    ? text
    : computedPriceCents != null
      ? centsToBRL(computedPriceCents)
      : "";

  return (
    <Input
      id="salePrice"
      data-testid="sale-price-input"
      inputMode="decimal"
      className="text-base"
      value={displayValue}
      onChange={(e) => {
        setText(e.target.value);
        onPriceChange(
          e.target.value.trim() === "" ? null : brlToCents(e.target.value),
        );
      }}
      onBlur={() => {
        setText(
          computedPriceCents != null ? centsToBRL(computedPriceCents) : "",
        );
      }}
    />
  );
}

export function MarkupCalculatorFields({
  costCents,
  markupPercent,
  computedPriceCents,
  priceIsManual,
  onCostChange,
  onMarkupChange,
  onPriceChange,
  onResetManual,
}: MarkupCalculatorFieldsProps) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cost">Custo</Label>
          <MoneyInput
            id="cost"
            value={costCents}
            onChange={onCostChange}
            placeholder="R$ 0,00"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="markup">Margem %</Label>
          <PercentInput
            id="markup"
            value={markupPercent}
            onChange={onMarkupChange}
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="salePrice">Preço de venda</Label>
          {priceIsManual ? (
            <Badge
              data-testid="price-manual"
              variant="secondary"
              className="gap-1"
            >
              Preço manual
              <button
                type="button"
                aria-label="Voltar ao preço calculado"
                onClick={onResetManual}
                className="ml-1 inline-flex"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ) : null}
        </div>
        <SalePriceField
          computedPriceCents={computedPriceCents}
          priceIsManual={priceIsManual}
          onPriceChange={onPriceChange}
        />
      </div>

      {/* Live Price Preview — herói (elemento-assinatura do design). */}
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Preço final</span>
        <span
          data-testid="live-price"
          className={
            priceIsManual
              ? "font-mono text-3xl font-bold text-muted-foreground"
              : "font-mono text-3xl font-bold text-primary"
          }
        >
          {computedPriceCents != null ? centsToBRL(computedPriceCents) : "—"}
        </span>
      </div>
    </div>
  );
}
