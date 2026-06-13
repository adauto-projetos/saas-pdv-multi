"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { removeComandaItemAction } from "@/app/(app)/comandas/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centsToBRL } from "@/lib/format/money";
import type { ComandaDto } from "@/types/comanda";

import { AddItemForm } from "./AddItemForm";

/**
 * RF02/RF03/RF05 — painel de itens da comanda aberta. Lista itens com
 * observação e subtotal; remove (estorna estoque, RN03). Total parcial
 * informativo (RF05/RN05). AddItemForm para lançar novos itens.
 */
export function ComandaItemPanel({ comanda }: { comanda: ComandaDto }) {
  const router = useRouter();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  async function handleRemove(itemId: string, name: string) {
    setRemovingId(itemId);
    const res = await removeComandaItemAction({
      comandaId: comanda.id,
      itemId,
    });
    setRemovingId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${name} removido`);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Itens</span>
          <span className="font-mono text-muted-foreground">
            Total parcial:{" "}
            <span className="font-semibold text-foreground">
              {centsToBRL(comanda.partialTotalCents)}
            </span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Valor informativo — o total cobrado é o do fechamento com os preços
          atuais dos produtos.
        </p>

        {comanda.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum item lançado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {comanda.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({item.unit})
                    </span>
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.observation ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {centsToBRL(item.subtotalCents)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover ${item.name}`}
                            disabled={removingId === item.id}
                          />
                        }
                      >
                        Remover
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover item?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remover{" "}
                            <span className="font-medium">{item.name}</span>{" "}
                            da comanda e estornar o estoque. Esta ação não pode
                            ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(item.id, item.name)}
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="grid gap-2">
        <h4 className="text-sm font-medium">Lançar item</h4>
        <AddItemForm comandaId={comanda.id} />
      </div>
    </div>
  );
}
