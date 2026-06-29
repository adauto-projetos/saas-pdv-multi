import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTenantHistory } = vi.hoisted(() => ({
  mockGetTenantHistory: vi.fn(),
}));

vi.mock("@/app/(admin)/superadmin/actions", () => ({
  getTenantHistoryAction: mockGetTenantHistory,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { SubscriptionHistoryModal } from "./SubscriptionHistoryModal";

const ENTRIES = [
  {
    id: "e1",
    action: "renewed" as const,
    validUntilBefore: new Date("2026-06-01"),
    validUntilAfter: new Date("2026-07-01"),
    byUserId: "u1",
    at: new Date("2026-06-15"),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockGetTenantHistory.mockResolvedValue({ ok: true, data: ENTRIES });
});

describe("SubscriptionHistoryModal (RF22)", () => {
  it("T46 — não busca dados quando open=false", () => {
    render(
      <SubscriptionHistoryModal
        tenantId="t1"
        tenantName="Loja Teste"
        open={false}
        onOpenChange={vi.fn()}
      />,
    );
    expect(mockGetTenantHistory).not.toHaveBeenCalled();
  });

  it("T45 — busca e exibe entries quando open=true", async () => {
    render(
      <SubscriptionHistoryModal
        tenantId="t1"
        tenantName="Loja Teste"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );
    expect(mockGetTenantHistory).toHaveBeenCalledWith("t1");
    const renewed = await screen.findByText("Renovado");
    expect(renewed).toBeInTheDocument();
  });
});
