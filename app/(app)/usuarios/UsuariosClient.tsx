"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  createOperatorAction,
  deactivateOperatorAction,
  reactivateOperatorAction,
  resetOperatorPasswordAction,
  updateOperatorAction,
  updateOperatorPermissionsAction,
} from "@/app/(app)/usuarios/actions";
import { PageCard } from "@/components/ui/PageCard";
import {
  PERMISSION_CODES,
  PERMISSION_LABELS,
  PERMISSION_PRESETS,
  type PermissionCode,
  type PresetKey,
} from "@/lib/validation/usuarios";
import type { OperatorDto } from "@/types/usuarios";

const PRESET_LABELS: Record<PresetKey, string> = {
  caixa: "Caixa (vendas + comanda)",
  gerente: "Gerente (tudo menos loja)",
};

/** Grade de checkboxes das 8 permissões. */
function PermissionGrid({
  selected,
  onToggle,
}: {
  selected: Set<PermissionCode>;
  onToggle: (code: PermissionCode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PERMISSION_CODES.map((code) => {
        const on = selected.has(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => onToggle(code)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: on ? "1.5px solid #4f46e5" : "1.5px solid #e2e8f0",
              background: on ? "#eef2ff" : "#fff",
              color: on ? "#4f46e5" : "#475569",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                flexShrink: 0,
                background: on ? "#4f46e5" : "transparent",
                border: on ? "none" : "1.5px solid #cbd5e1",
                color: "#fff",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {on ? "✓" : ""}
            </span>
            {PERMISSION_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  width: "100%",
};

/** Formulário de criação de operador (nome, email, senha, presets, permissões). */
function CreateOperatorForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selected, setSelected] = React.useState<Set<PermissionCode>>(new Set());
  const [saving, setSaving] = React.useState(false);

  function toggle(code: PermissionCode) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function applyPreset(key: PresetKey) {
    setSelected(new Set(PERMISSION_PRESETS[key]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selected.size === 0) {
      toast.error("Selecione ao menos uma permissão");
      return;
    }
    setSaving(true);
    const result = await createOperatorAction({
      name,
      email,
      password,
      permissions: [...selected],
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Operador criado");
      setName("");
      setEmail("");
      setPassword("");
      setSelected(new Set());
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          style={inputStyle}
          placeholder="Nome do operador"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          style={inputStyle}
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={inputStyle}
          type="password"
          placeholder="Senha provisória"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-400">Presets:</span>
        {(Object.keys(PERMISSION_PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12px] font-bold text-indigo-600"
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      <PermissionGrid selected={selected} onToggle={toggle} />

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
        {saving ? "Criando..." : "Criar operador"}
      </button>
    </form>
  );
}

/** Linha de operador com permissões editáveis e ações. */
function OperatorRow({
  operator,
  onChanged,
}: {
  operator: OperatorDto;
  onChanged: () => void;
}) {
  const [panel, setPanel] = React.useState<"perms" | "data" | "reset" | null>(
    null,
  );
  const [selected, setSelected] = React.useState<Set<PermissionCode>>(
    new Set(operator.permissions),
  );
  const [name, setName] = React.useState(operator.name ?? "");
  const [email, setEmail] = React.useState(operator.email);
  const [newPassword, setNewPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  function openPanel(target: "perms" | "data" | "reset") {
    setPanel((cur) => (cur === target ? null : target));
  }

  function toggle(code: PermissionCode) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function savePermissions() {
    if (selected.size === 0) {
      toast.error("Selecione ao menos uma permissão");
      return;
    }
    setBusy(true);
    const result = await updateOperatorPermissionsAction({
      userId: operator.userId,
      permissions: [...selected],
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Permissões salvas");
      setPanel(null);
      onChanged();
    } else {
      toast.error(result.error);
    }
  }

  async function saveData() {
    setBusy(true);
    const result = await updateOperatorAction({
      userId: operator.userId,
      name,
      email,
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Dados atualizados");
      setPanel(null);
      onChanged();
    } else {
      toast.error(result.error);
    }
  }

  async function toggleActive() {
    setBusy(true);
    const action = operator.isActive
      ? deactivateOperatorAction
      : reactivateOperatorAction;
    const result = await action({ userId: operator.userId });
    setBusy(false);
    if (result.ok) {
      toast.success(operator.isActive ? "Operador desativado" : "Operador reativado");
      onChanged();
    } else {
      toast.error(result.error);
    }
  }

  async function resetPassword() {
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa de ao menos 6 caracteres.");
      return;
    }
    setBusy(true);
    const result = await resetOperatorPasswordAction({
      userId: operator.userId,
      password: newPassword,
    });
    setBusy(false);
    if (result.ok) {
      toast.success("Senha redefinida");
      setNewPassword("");
      setPanel(null);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="border-b border-gray-100 px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">
              {operator.name ?? operator.email}
            </span>
            {operator.isOwner && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                Dono
              </span>
            )}
            {!operator.isActive && (
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
                Inativo
              </span>
            )}
          </div>
          <div className="text-[13px] text-gray-400">{operator.email}</div>
          {!operator.isOwner && (
            <div className="mt-1 text-[12px] text-gray-500">
              {operator.permissions.length === 0
                ? "Sem permissões"
                : operator.permissions
                    .map((c) => PERMISSION_LABELS[c])
                    .join(", ")}
            </div>
          )}
          {operator.isOwner && (
            <div className="mt-1 text-[12px] text-gray-500">
              Todas as permissões
            </div>
          )}
        </div>

        {!operator.isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel("data")}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-700"
            >
              Editar dados
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel("perms")}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-700"
            >
              Permissões
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel("reset")}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-bold text-gray-700"
            >
              Resetar senha
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={toggleActive}
              className="rounded-lg border px-3 py-1.5 text-[12px] font-bold"
              style={{
                borderColor: operator.isActive ? "#fecaca" : "#bbf7d0",
                color: operator.isActive ? "#dc2626" : "#16a34a",
              }}
            >
              {operator.isActive ? "Desativar" : "Reativar"}
            </button>
          </div>
        )}
      </div>

      {panel === "perms" && !operator.isOwner && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
          <PermissionGrid selected={selected} onToggle={toggle} />
          <button
            type="button"
            disabled={busy}
            onClick={savePermissions}
            className="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white"
          >
            {busy ? "Salvando..." : "Salvar permissões"}
          </button>
        </div>
      )}

      {panel === "data" && !operator.isOwner && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              style={inputStyle}
              placeholder="Nome do operador"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={inputStyle}
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={saveData}
            className="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white"
          >
            {busy ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      )}

      {panel === "reset" && !operator.isOwner && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-gray-50 p-4">
          <input
            style={inputStyle}
            type="password"
            placeholder="Nova senha provisória (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={resetPassword}
            className="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white"
          >
            {busy ? "Salvando..." : "Redefinir senha"}
          </button>
        </div>
      )}
    </div>
  );
}

export function UsuariosClient({
  operators,
  maxOperators,
}: {
  operators: OperatorDto[];
  maxOperators: number;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  // "X de N operadores" — só operadores ativos contam (owner e inativos fora, RN02/RN03).
  const activeOperators = operators.filter(
    (o) => !o.isOwner && o.isActive,
  ).length;
  const limitReached = activeOperators >= maxOperators;

  return (
    <div className="flex flex-col gap-5">
      <PageCard>
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          <span>Novo operador</span>
          <span
            className="rounded-md px-2.5 py-1 text-[12px] font-bold"
            style={{
              background: limitReached ? "#fef2f2" : "#eef2ff",
              color: limitReached ? "#dc2626" : "#4f46e5",
            }}
          >
            {activeOperators} de {maxOperators} operadores
          </span>
        </div>
        {limitReached ? (
          <p className="px-5 py-4 text-sm text-gray-500">
            Limite de operadores atingido. Desative um operador ou peça ao
            suporte para aumentar o limite do seu plano.
          </p>
        ) : (
          <CreateOperatorForm onDone={refresh} />
        )}
      </PageCard>

      <PageCard>
        <div
          className="px-5 py-4 border-b border-gray-100"
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: 16,
            color: "#0f172a",
          }}
        >
          Operadores ({operators.length})
        </div>
        {operators.map((op) => (
          <OperatorRow key={op.userId} operator={op} onChanged={refresh} />
        ))}
      </PageCard>
    </div>
  );
}
