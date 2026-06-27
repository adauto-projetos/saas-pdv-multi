"use client";

import * as React from "react";
import { toast } from "sonner";

import { changeOwnPasswordAction } from "@/app/(app)/usuarios/actions";

const inputStyle: React.CSSProperties = {
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  width: "100%",
};

/** RF08 — operador troca a própria senha (qualquer usuário logado). */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await changeOwnPasswordAction({
      currentPassword,
      newPassword,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Senha alterada");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input
        style={inputStyle}
        type="password"
        placeholder="Senha atual"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <input
        style={inputStyle}
        type="password"
        placeholder="Nova senha"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <button
        type="submit"
        disabled={saving}
        style={{
          height: 44,
          width: "fit-content",
          padding: "0 22px",
          border: "none",
          borderRadius: 12,
          background: "#4f46e5",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
