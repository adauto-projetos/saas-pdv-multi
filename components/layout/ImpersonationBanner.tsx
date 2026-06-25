"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";

import { exitStoreAction } from "@/app/(admin)/superadmin/impersonation-actions";

interface ImpersonationBannerProps {
  storeName: string;
}

/**
 * Barra fixa exibida no topo do app quando o super admin está impersonando uma
 * loja (SF03 RF12). Deixa explícito que a sessão não é a operação normal e
 * oferece a saída rápida ("Sair da loja") que limpa o cookie e volta ao painel.
 */
export function ImpersonationBanner({ storeName }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      await exitStoreAction();
    });
  }

  return (
    <div
      style={{
        background: "#b45309",
        color: "#fff",
        padding: "8px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <Eye size={16} strokeWidth={2} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Você está dentro da loja <strong>{storeName}</strong> como super admin
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        aria-busy={isPending}
        style={{
          flexShrink: 0,
          background: "rgba(255,255,255,0.18)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 8,
          padding: "5px 12px",
          fontSize: 12.5,
          fontWeight: 700,
          cursor: isPending ? "default" : "pointer",
        }}
      >
        {isPending ? "Saindo…" : "Sair da loja"}
      </button>
    </div>
  );
}
