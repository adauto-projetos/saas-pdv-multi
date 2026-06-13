"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { cancelComandaAction } from "@/app/(app)/comandas/actions";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { centsToBRL } from "@/lib/format/money";
import type { ComandaDto, ComandaStatus } from "@/types/comanda";

import { CloseComandaDialog } from "./CloseComandaDialog";
import { ComandaItemPanel } from "./ComandaItemPanel";

function StatusBadge({ status }: { status: ComandaStatus }) {
  if (status === "aberta") {
    return <Badge variant="default">Aberta</Badge>;
  }
  if (status === "fechada") {
    return <Badge variant="secondary">Fechada</Badge>;
  }
  return <Badge variant="destructive">Cancelada</Badge>;
}

/**
 * RF05/RF06/RF04 — card de uma comanda. Abertas: expandem o item panel,
 * oferecem fechar e cancelar (com AlertDialog confirm). Fechadas/canceladas:
 * somente leitura. Mirrors CashSessionPanel lifecycle pattern.
 */
export function ComandaCard({
  comanda,
  expanded,
  onToggleExpand,
}: {
  comanda: ComandaDto;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);

  const isAberta = comanda.status === "aberta";

  async function handleCancel() {
    setCancelling(true);
    const res = await cancelComandaAction({ comandaId: comanda.id });
    setCancelling(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Comanda "${comanda.label}" cancelada`);
    router.refresh();
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="grid gap-1">
            <CardDescription>Comanda</CardDescription>
            <CardTitle className="text-lg">{comanda.label}</CardTitle>
          </div>
          <StatusBadge status={comanda.status} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Aberta em</span>
          <span>
            {new Date(comanda.openedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Itens: {comanda.items.length}
          </span>
          <span className="font-mono font-semibold">
            {centsToBRL(comanda.partialTotalCents)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              parcial
            </span>
          </span>
        </div>

        {isAberta ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleExpand}
              >
                {expanded ? "Ocultar itens" : "Lançar item"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setCloseOpen(true)}
              >
                Fechar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelling}
                    />
                  }
                >
                  Cancelar
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar comanda?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A comanda{" "}
                      <span className="font-medium">{comanda.label}</span> será
                      cancelada e o estoque de todos os itens será estornado.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>
                      Cancelar comanda
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {expanded ? <ComandaItemPanel comanda={comanda} /> : null}
          </div>
        ) : null}

        {comanda.closedAt ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {comanda.status === "fechada" ? "Fechada em" : "Cancelada em"}
            </span>
            <span>
              {new Date(comanda.closedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ) : null}
      </CardContent>

      {isAberta ? (
        <CloseComandaDialog
          comanda={comanda}
          open={closeOpen}
          onOpenChange={setCloseOpen}
        />
      ) : null}
    </Card>
  );
}
