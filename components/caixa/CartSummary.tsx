"use client";

import { Button } from "@/components/ui/button";
import { centsToBRL } from "@/lib/format/money";

export function CartSummary({
  totalCents,
  itemCount,
  onFinalize,
  onCancel,
  disabled,
}: {
  totalCents: number;
  itemCount: number;
  onFinalize: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const empty = itemCount === 0;
  return (
    <div className="flex items-center justify-between gap-4 border-t pt-4">
      <div>
        <p className="text-sm text-muted-foreground">Total</p>
        <p
          data-testid="cart-total"
          aria-live="polite"
          aria-atomic="true"
          className="font-mono text-3xl font-bold text-primary"
        >
          {centsToBRL(totalCents)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={disabled || empty}
        >
          Cancelar
        </Button>
        <Button onClick={onFinalize} disabled={disabled || empty}>
          Finalizar
        </Button>
      </div>
    </div>
  );
}
