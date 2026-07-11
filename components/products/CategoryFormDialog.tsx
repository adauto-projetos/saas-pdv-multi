"use client";

import * as React from "react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/services/errors";
import { cn } from "@/lib/utils";
import {
  CATEGORY_PALETTE,
  createProductCategorySchema,
} from "@/lib/validation/product";
import type {
  CategoryColor,
  CreateProductCategoryInput,
} from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

type CategoryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Categoria em edição (RF02/RF05); ausente/null = criar (RF01/RF04). */
  category?: Pick<ProductCategoryDto, "id" | "name" | "color"> | null;
  /**
   * Quem chama liga o submit à action (create ou update) e é dono dos
   * side-effects de sucesso (toast/refresh/seleção). O dialog valida com
   * `safeParse`, exibe `fieldErrors` inline e fecha sozinho quando `ok`.
   */
  onSubmit: (
    input: CreateProductCategoryInput,
  ) => Promise<ActionResult<ProductCategoryDto>>;
};

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

const PALETTE_ENTRIES = Object.entries(CATEGORY_PALETTE) as [
  CategoryColor,
  (typeof CATEGORY_PALETTE)[CategoryColor],
][];

/**
 * Dialog de criar/editar categoria (RF01/RF02): nome + paleta de swatches da
 * CATEGORY_PALETTE. Cor é opcional na criação — sem escolha, o service aplica
 * a próxima cor da paleta cíclica (RN05). Reusado pelo CategoryManager e pela
 * criação inline do CategorySelect (RF04).
 */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
}: CategoryFormDialogProps) {
  const [name, setName] = React.useState(category?.name ?? "");
  const [color, setColor] = React.useState<CategoryColor | null>(
    category?.color ?? null,
  );
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);
  const [prevCategory, setPrevCategory] = React.useState(category);

  // Reconciliação na renderização (padrão QuantityInput, sem useEffect):
  // reabrir — ou trocar a categoria em edição — reinicia o formulário.
  if (open !== prevOpen || category !== prevCategory) {
    setPrevOpen(open);
    setPrevCategory(category);
    if (open) {
      setName(category?.name ?? "");
      setColor(category?.color ?? null);
      setFieldErrors({});
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});

    // Cor omitida deixa o service escolher a próxima da paleta (RN05).
    const parsed = createProductCategorySchema.safeParse({
      name,
      color: color ?? undefined,
    });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      return;
    }

    setSubmitting(true);
    const result = await onSubmit(parsed.data);
    setSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              className="text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vinhos"
            />
            {fieldErrors.name ? (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE_ENTRIES.map(([slug, palette]) => (
                <button
                  key={slug}
                  type="button"
                  aria-label={`Cor ${slug}`}
                  aria-pressed={color === slug}
                  onClick={() => setColor(slug)}
                  className={cn(
                    // 44px de alvo de toque (mobile-first).
                    "size-11 rounded-full border-2 outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
                    color === slug ? "ring-2 ring-ring ring-offset-2" : null,
                  )}
                  style={{
                    backgroundColor: palette.bg,
                    borderColor: palette.bd,
                  }}
                />
              ))}
            </div>
            {!category && color === null ? (
              <p className="text-sm text-muted-foreground">
                Sem escolher, a cor é definida automaticamente.
              </p>
            ) : null}
            {fieldErrors.color ? (
              <p className="text-sm text-destructive">{fieldErrors.color}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
