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
import { Button } from "@/components/ui/button";
import { PageCard } from "@/components/ui/PageCard";
import { centsToBRL } from "@/lib/format/money";
import type { ComandaDto, ComandaStatus } from "@/types/comanda";

import { CloseComandaDialog } from "./CloseComandaDialog";
import { ComandaItemPanel } from "./ComandaItemPanel";
import { OverrideDialog, type OverrideCredentials } from "./OverrideDialog";

function StatusBadge({ status }: { status: ComandaStatus }) {
  if (status === "aberta") {
    return (
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
        Aberta
      </span>
    );
  }
  if (status === "fechada") {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">
        Fechada
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-600">
      Cancelada
    </span>
  );
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
  const [overrideOpen, setOverrideOpen] = React.useState(false);

  const isAberta = comanda.status === "aberta";

  function applyCancelled() {
    toast.success(`Comanda "${comanda.label}" cancelada`);
    router.refresh();
  }

  async function handleCancel() {
    setCancelling(true);
    const res = await cancelComandaAction({ comandaId: comanda.id });
    setCancelling(false);

    if (!res.ok) {
      // SF02: sem permissão "comanda" → abre o diálogo de override.
      if (res.overrideRequired) {
        setOverrideOpen(true);
        return;
      }
      toast.error(res.error);
      return;
    }
    applyCancelled();
  }

  /** Reenvia o cancelamento com as credenciais do autorizador (SF02). */
  async function handleAuthorizeCancel(credentials: OverrideCredentials) {
    const res = await cancelComandaAction({ comandaId: comanda.id }, credentials);
    if (!res.ok) return { ok: false, error: res.error };
    setOverrideOpen(false);
    applyCancelled();
    return { ok: true };
  }

  return (
    <PageCard>
      <div className="p-[18px]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.5px] text-gray-400">
              Comanda
            </div>
            <div className="text-[16px] font-bold text-gray-900">
              {comanda.label}
            </div>
          </div>
          <StatusBadge status={comanda.status} />
        </div>

        {/* Stats row */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 border-y border-gray-100 py-3">
          <div>
            <div className="mb-0.5 text-[10px] font-medium text-gray-400">
              Aberta em
            </div>
            <div className="text-[12px] font-medium text-gray-700">
              {new Date(comanda.openedAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-0.5 text-[10px] font-medium text-gray-400">
              Total parcial
            </div>
            <div className="text-[15px] font-bold text-green-600">
              {centsToBRL(comanda.partialTotalCents)}
            </div>
          </div>
        </div>

        <div className="mb-3 text-[11px] text-gray-500">
          {comanda.items.length}{" "}
          {comanda.items.length === 1 ? "item" : "itens"}
        </div>

        {isAberta ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onToggleExpand}
                className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-[12px] font-medium text-gray-500 hover:bg-gray-50"
              >
                {expanded ? "Ocultar itens" : "Lançar item"}
              </button>
              <button
                onClick={() => setCloseOpen(true)}
                className="flex-1 rounded-lg bg-green-600 py-1.5 text-[12px] font-semibold text-white hover:bg-green-700"
              >
                Fechar
              </button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelling}
                      className="rounded-lg px-3 py-1.5 text-[12px]"
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
          <div className="mt-2 flex items-center justify-between text-[12px] text-gray-400">
            <span>
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
      </div>

      {isAberta ? (
        <CloseComandaDialog
          comanda={comanda}
          open={closeOpen}
          onOpenChange={setCloseOpen}
        />
      ) : null}

      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        actionLabel="cancelar a comanda"
        onAuthorize={handleAuthorizeCancel}
      />
    </PageCard>
  );
}
