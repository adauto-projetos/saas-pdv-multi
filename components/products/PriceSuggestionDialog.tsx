"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { centsToBRL } from "@/lib/format/money";
import type { PriceSuggestionDto } from "@/types/product";

type PriceSuggestionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: PriceSuggestionDto;
  /** Aplicar: salva custo + novo preço sugerido. */
  onConfirm: () => void;
  /** Manter: salva só o custo, preço inalterado. */
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function PriceSuggestionDialog({
  open,
  onOpenChange,
  suggestion,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: PriceSuggestionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Atualizar o preço de venda?</AlertDialogTitle>
          <AlertDialogDescription>
            O custo mudou. Veja o novo preço sugerido a partir da margem da loja.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Preço atual</span>
            <span className="font-mono">
              {centsToBRL(suggestion.currentSalePriceCents)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Preço sugerido</span>
            <span className="font-mono font-bold text-primary">
              {centsToBRL(suggestion.suggestedSalePriceCents)}
            </span>
          </div>
        </div>

        {suggestion.warnManualOverride ? (
          <p
            data-testid="manual-warning"
            className="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
          >
            O preço atual foi definido manualmente. Aplicar a sugestão vai
            substituí-lo.
          </p>
        ) : null}

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Manter preço atual
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Aplicando..." : "Aplicar novo preço"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
