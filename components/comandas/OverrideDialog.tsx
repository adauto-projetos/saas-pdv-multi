"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export interface OverrideCredentials {
  authorizerEmail: string;
  password: string;
}

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto da ação que está sendo liberada (ex.: "cancelar a comanda"). */
  actionLabel: string;
  /**
   * Reenvia a ação original com as credenciais do autorizador. Retorna ok=true se
   * a ação foi liberada (o pai trata o sucesso e fecha o diálogo).
   */
  onAuthorize: (
    credentials: OverrideCredentials,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Diálogo de override de ação sensível (0014F/SF02). Quando o operador não tem o
 * código necessário, um Administrador digita e-mail + senha aqui para LIBERAR a
 * ação na hora, sem trocar de login. A ação roda com a autoria do operador.
 */
export function OverrideDialog({
  open,
  onOpenChange,
  actionLabel,
  onAuthorize,
}: OverrideDialogProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setEmail("");
    setPassword("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onAuthorize({ authorizerEmail: email, password });
    setSubmitting(false);
    if (result.ok) {
      reset();
    } else {
      setError(result.error ?? "Autorização negada.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Autorização necessária</DialogTitle>
          <DialogDescription>
            Você não tem permissão para {actionLabel}. Peça a um administrador para
            liberar com o e-mail e a senha dele.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="override-email">E-mail do administrador</Label>
            <input
              id="override-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                height: 42,
                padding: "0 12px",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                fontSize: 14,
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="override-password">Senha do administrador</Label>
            <input
              id="override-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                height: 42,
                padding: "0 12px",
                borderRadius: 10,
                border: "1.5px solid #e2e8f0",
                fontSize: 14,
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Liberando..." : "Liberar ação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
