"use client";

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  countProductsInCategoryAction,
  createProductCategoryAction,
  deleteProductCategoryAction,
  reorderProductCategoriesAction,
  updateProductCategoryAction,
} from "@/app/(app)/products/categories/actions";
import { CategoryFormDialog } from "@/components/products/CategoryFormDialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CATEGORY_PALETTE } from "@/lib/validation/product";
import type { CreateProductCategoryInput } from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

type DialogState =
  | { type: "create" }
  | { type: "edit"; category: ProductCategoryDto }
  | { type: "delete"; category: ProductCategoryDto; count: number }
  | null;

type CategoryManagerProps = {
  /** Categorias do tenant ordenadas por `position` (vindas do RSC). */
  categories: ProductCategoryDto[];
};

/**
 * Superfície de gestão de categorias (RF05): lista com chip colorido da
 * CATEGORY_PALETTE e, por item, renomear/recolorir (CategoryFormDialog),
 * reordenar com botões ▲▼ de 44px (RF06, swap otimista + lista completa) e
 * excluir com aviso de contagem (RF03: "N produtos serão movidos para Sem
 * categoria" antes de confirmar).
 */
export function CategoryManager({ categories }: CategoryManagerProps) {
  const router = useRouter();
  const [items, setItems] = React.useState(categories);
  const [prevCategories, setPrevCategories] = React.useState(categories);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [isPending, startTransition] = React.useTransition();
  // Item em mutação — desabilita só os controles daquela linha.
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Reconciliação na renderização (padrão QuantityInput, sem useEffect): após
  // router.refresh() o RSC injeta a lista nova — ressincroniza o estado otimista.
  if (categories !== prevCategories) {
    setPrevCategories(categories);
    setItems(categories);
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    // Swap otimista; a action recebe a lista COMPLETA de ids (RF06).
    setItems(next);
    startTransition(async () => {
      const result = await reorderProductCategoriesAction({
        orderedIds: next.map((c) => c.id),
      });
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteRequest(category: ProductCategoryDto) {
    setPendingId(category.id);
    startTransition(async () => {
      // RF03: contagem ANTES do aviso — a exclusão só acontece após confirmar.
      const result = await countProductsInCategoryAction({ id: category.id });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDialog({ type: "delete", category, count: result.data.count });
    });
  }

  function handleDeleteConfirm() {
    if (dialog?.type !== "delete") return;
    const { category } = dialog;
    setPendingId(category.id);
    startTransition(async () => {
      const result = await deleteProductCategoryAction({ id: category.id });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDialog(null);
      const { movedCount } = result.data;
      toast.success(
        movedCount > 0
          ? `Categoria excluída. ${movedCount} ${
              movedCount === 1 ? "produto movido" : "produtos movidos"
            } para Sem categoria.`
          : "Categoria excluída.",
      );
      router.refresh();
    });
  }

  async function handleFormSubmit(input: CreateProductCategoryInput) {
    const editing = dialog?.type === "edit" ? dialog.category : null;
    const result = editing
      ? await updateProductCategoryAction({ id: editing.id, ...input })
      : await createProductCategoryAction(input);
    if (result.ok) {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      router.refresh();
    }
    return result;
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button size="lg" onClick={() => setDialog({ type: "create" })}>
          <Plus />
          Nova categoria
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-medium text-gray-900">Nenhuma categoria ainda</p>
          <p className="mt-1 text-sm text-gray-400">
            Crie a primeira categoria para organizar os produtos.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {items.map((category, index) => {
            const palette = CATEGORY_PALETTE[category.color];
            const rowPending = isPending && pendingId === category.id;
            return (
              <li
                key={category.id}
                className="flex items-center justify-between gap-2 rounded-xl border bg-background p-2"
              >
                <span
                  className="min-w-0 truncate rounded-full border px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: palette.bg,
                    color: palette.fg,
                    borderColor: palette.bd,
                  }}
                >
                  {category.name}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  {/* ▲▼ com 44px de alvo de toque (mobile-first, RF06). */}
                  <Button
                    variant="ghost"
                    className="size-11"
                    aria-label={`Mover ${category.name} para cima`}
                    disabled={index === 0 || isPending}
                    onClick={() => handleMove(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-11"
                    aria-label={`Mover ${category.name} para baixo`}
                    disabled={index === items.length - 1 || isPending}
                    onClick={() => handleMove(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-11"
                    aria-label={`Editar ${category.name}`}
                    disabled={rowPending}
                    onClick={() => setDialog({ type: "edit", category })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    className="size-11 text-destructive hover:text-destructive"
                    aria-label={`Excluir ${category.name}`}
                    disabled={rowPending}
                    onClick={() => handleDeleteRequest(category)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog?.type === "create" || dialog?.type === "edit" ? (
        <CategoryFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          category={dialog.type === "edit" ? dialog.category : null}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      {dialog?.type === "delete" ? (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Excluir a categoria &quot;{dialog.category.name}&quot;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.count > 0
                  ? `${dialog.count} ${
                      dialog.count === 1
                        ? "produto será movido"
                        : "produtos serão movidos"
                    } para Sem categoria.`
                  : "Nenhum produto usa esta categoria."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isPending}
              >
                Excluir categoria
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
