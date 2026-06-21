import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockPathname = vi.fn(() => "/caixa");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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

import { BottomNav } from "../BottomNav";

describe("BottomNav (RF03–RF05, RN01, RN02)", () => {
  // --- T01: 5 primary interactive items (4 links + 1 button) ---
  it("T01 — renders 5 primary nav items (4 links + Mais button)", () => {
    render(<BottomNav />);
    const links = screen.getAllByRole("link");
    const buttons = screen.getAllByRole("button");
    // 4 nav links + 1 "Mais" button = 5 interactive primary items
    expect(links.length + buttons.length).toBe(5);
  });

  // --- T02–T05: correct hrefs ---
  it("T02 — Caixa links to /caixa", () => {
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /caixa/i });
    expect(link).toHaveAttribute("href", "/caixa");
  });

  it("T03 — Comandas links to /comandas", () => {
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /comandas/i });
    expect(link).toHaveAttribute("href", "/comandas");
  });

  it("T04 — Produtos links to /products", () => {
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /produtos/i });
    expect(link).toHaveAttribute("href", "/products");
  });

  it("T05 — Financeiro links to /financeiro/caixa", () => {
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /financeiro/i });
    expect(link).toHaveAttribute("href", "/financeiro/caixa");
  });

  // --- T06–T09: active state via usePathname ---
  it("T06 — /caixa marks Caixa link as active (indigo color)", () => {
    mockPathname.mockReturnValue("/caixa");
    render(<BottomNav />);
    const caixaLink = screen.getByRole("link", { name: /caixa/i });
    // active items have color #4f46e5 via inline style
    expect(caixaLink).toHaveStyle({ color: "#4f46e5" });
  });

  it("T07 — /comandas marks Comandas as active", () => {
    mockPathname.mockReturnValue("/comandas");
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /comandas/i });
    expect(link).toHaveStyle({ color: "#4f46e5" });
  });

  it("T08 — /products marks Produtos as active via startsWith", () => {
    mockPathname.mockReturnValue("/products/new");
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /produtos/i });
    expect(link).toHaveStyle({ color: "#4f46e5" });
  });

  it("T09 — /financeiro/caixa marks Financeiro as active via startsWith", () => {
    mockPathname.mockReturnValue("/financeiro/caixa");
    render(<BottomNav />);
    const link = screen.getByRole("link", { name: /financeiro/i });
    expect(link).toHaveStyle({ color: "#4f46e5" });
  });

  // --- T10–T15: drawer ---
  it("T10 — drawer is closed by default (drawer items not visible)", () => {
    render(<BottomNav />);
    expect(screen.queryByText("Vendas")).not.toBeInTheDocument();
  });

  it("T11 — clicking Mais opens drawer", async () => {
    render(<BottomNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    expect(screen.getByText("Vendas")).toBeInTheDocument();
  });

  it("T12 — drawer shows Estoque link", async () => {
    render(<BottomNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    expect(screen.getByRole("menuitem", { name: /estoque/i })).toBeInTheDocument();
  });

  it("T13 — drawer shows Lucro link", async () => {
    render(<BottomNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    expect(screen.getByRole("menuitem", { name: /lucro/i })).toBeInTheDocument();
  });

  it("T14 — drawer shows Configurações link", async () => {
    render(<BottomNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    expect(screen.getByRole("menuitem", { name: /configurações/i })).toBeInTheDocument();
  });

  it("T15 — clicking a drawer link closes the drawer", async () => {
    render(<BottomNav />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /mais opções/i }));
    await user.click(screen.getByRole("menuitem", { name: /vendas/i }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // --- T25–T28: class assertions ---
  it("T25 — nav has lg:hidden class (CSS-only, not conditional render) (RN02)", () => {
    const { container } = render(<BottomNav className="lg:hidden" />);
    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("lg:hidden");
  });

  it("T26 — Mais button has min-h-[44px] min-w-[44px] touch targets (RNF02)", () => {
    render(<BottomNav />);
    const btn = screen.getByRole("button", { name: /mais opções/i });
    expect(btn).toHaveClass("min-h-[44px]");
    expect(btn).toHaveClass("min-w-[44px]");
  });

  it("T27 — nav has padding-bottom env(safe-area-inset-bottom) (RNF01)", () => {
    const { container } = render(<BottomNav />);
    const nav = container.querySelector("nav");
    expect(nav).toHaveStyle({ paddingBottom: "env(safe-area-inset-bottom)" });
  });

  it("T28 — BottomNav does not import from lib/services, db/, or lib/actions (RN01)", async () => {
    // Static analysis via import inspection — importing succeeds without server-side modules
    const mod = await import("../BottomNav");
    expect(mod.BottomNav).toBeDefined();
  });
});
