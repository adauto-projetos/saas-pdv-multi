import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock server actions
vi.mock("@/app/(admin)/superadmin/actions", () => ({
  releaseSubscriptionAction: vi.fn().mockResolvedValue({ ok: true, data: { newValidUntil: new Date() } }),
  suspendTenantAction: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  releaseFromSuspensionAction: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

// Mock dialog components to keep tests simple
vi.mock("./release-dialog", () => ({
  ReleaseDialog: ({
    open,
    onConfirm,
    onOpenChange,
    tenant,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (o: boolean) => void;
    tenant: { name: string };
  }) =>
    open ? (
      <div data-testid="release-dialog">
        <span>ReleaseDialog:{tenant.name}</span>
        <button onClick={onConfirm}>confirm-release</button>
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

vi.mock("./suspend-dialog", () => ({
  SuspendDialog: ({
    open,
    onConfirm,
    onOpenChange,
    tenant,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (o: boolean) => void;
    tenant: { name: string };
  }) =>
    open ? (
      <div data-testid="suspend-dialog">
        <span>SuspendDialog:{tenant.name}</span>
        <button onClick={onConfirm}>confirm-suspend</button>
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

vi.mock("./subscription-history-modal", () => ({
  SubscriptionHistoryModal: ({
    open,
    onOpenChange,
    tenantName,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    tenantName: string;
  }) =>
    open ? (
      <div data-testid="history-modal">
        <span>History:{tenantName}</span>
        <button onClick={() => onOpenChange(false)}>close</button>
      </div>
    ) : null,
}));

vi.mock("./tenant-status-badge", () => ({
  TenantStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

import { releaseSubscriptionAction, suspendTenantAction } from "@/app/(admin)/superadmin/actions";
import { TenantTable } from "./tenant-table";

const TENANTS = [
  {
    id: "t1",
    name: "Loja Ativa",
    status: "ativa" as const,
    validUntil: new Date("2026-07-01"),
    suspendedAt: null,
    revenueCents: 5000,
    lastActivityAt: new Date("2026-06-01"),
  },
  {
    id: "t2",
    name: "Loja Travada",
    status: "travada" as const,
    validUntil: new Date("2026-05-01"),
    suspendedAt: new Date("2026-05-15"),
    revenueCents: 0,
    lastActivityAt: null,
  },
];

describe("TenantTable (RF10–RF12, RF16a, RF19)", () => {
  it("T21 — renderiza todas as colunas obrigatórias", () => {
    render(<TenantTable tenants={TENANTS} />);
    const headers = screen.getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent?.toLowerCase() ?? "");
    expect(headerTexts.some((t) => t.includes("loja"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("estado"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("vencimento"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("faturamento"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("acesso"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("ações"))).toBe(true);
  });

  it("T23 — ordena: travada primeiro, depois valid_until ASC", () => {
    render(<TenantTable tenants={TENANTS} />);
    const rows = screen.getAllByRole("row");
    // first data row (index 1) should be "Loja Travada"
    expect(rows[1]).toHaveTextContent("Loja Travada");
  });

  it("T29 — ReleaseDialog abre ao clicar +30 dias; action não chamada ainda", async () => {
    render(<TenantTable tenants={TENANTS} />);
    const user = userEvent.setup();
    const btns = screen.getAllByText("+30 dias");
    await user.click(btns[0]);
    expect(screen.getByTestId("release-dialog")).toBeInTheDocument();
    expect(releaseSubscriptionAction).not.toHaveBeenCalled();
  });

  it("T30 — confirmar ReleaseDialog chama releaseSubscriptionAction", async () => {
    render(<TenantTable tenants={TENANTS} />);
    const user = userEvent.setup();
    await user.click(screen.getAllByText("+30 dias")[0]);
    await user.click(screen.getByText("confirm-release"));
    expect(releaseSubscriptionAction).toHaveBeenCalled();
  });

  it("T35 — SuspendDialog abre ao clicar Suspender; action não chamada ainda", async () => {
    render(<TenantTable tenants={[TENANTS[0]!]} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Suspender"));
    expect(screen.getByTestId("suspend-dialog")).toBeInTheDocument();
    expect(suspendTenantAction).not.toHaveBeenCalled();
  });

  it("T36 — confirmar SuspendDialog chama suspendTenantAction", async () => {
    render(<TenantTable tenants={[TENANTS[0]!]} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Suspender"));
    await user.click(screen.getByText("confirm-suspend"));
    expect(suspendTenantAction).toHaveBeenCalled();
  });

  it("T37 — exibe botão Liberar suspensão (não Suspender) para tenant com suspendedAt", () => {
    render(<TenantTable tenants={[TENANTS[1]!]} />);
    expect(screen.getByText("Liberar suspensão")).toBeInTheDocument();
    expect(screen.queryByText("Suspender")).not.toBeInTheDocument();
  });
});
