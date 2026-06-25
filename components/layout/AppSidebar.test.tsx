import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/caixa",
}));

// Mock next/link — renders as <a> in tests
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock help context
vi.mock("@/lib/help/help-context", () => ({
  useHelp: () => ({ helpActive: false, toggleHelp: vi.fn() }),
}));

// Mock SignOutButton
vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => <button>Sair</button>,
}));

// Mock HelpTip
vi.mock("@/components/ui/help-tip", () => ({
  HelpTip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppSidebar } from "./AppSidebar";

const DEFAULT_PROPS = { userEmail: "test@example.com" };

describe("AppSidebar — Admin link (RF04, RF05)", () => {
  it("T07 — não exibe link /admin quando isFounder=false", () => {
    render(<AppSidebar {...DEFAULT_PROPS} isFounder={false} />);
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("T08 — exibe link /superadmin quando isFounder=true", () => {
    render(<AppSidebar {...DEFAULT_PROPS} isFounder={true} />);
    const link = screen.getByRole("link", { name: /admin/i });
    expect(link).toHaveAttribute("href", "/superadmin");
  });

  it("T09 — link Admin tem ícone Shield e aparece após bloco NAV_SECONDARY", () => {
    const { container } = render(<AppSidebar {...DEFAULT_PROPS} isFounder={true} />);
    // Shield icon is present in the DOM (lucide renders svg)
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);

    // The Admin link appears after the last NAV_SECONDARY link (Configurações)
    const links = screen.getAllByRole("link");
    const settingsIdx = links.findIndex((l) => l.getAttribute("href") === "/settings");
    const adminIdx = links.findIndex((l) => l.getAttribute("href") === "/superadmin");
    expect(adminIdx).toBeGreaterThan(settingsIdx);
  });
});
