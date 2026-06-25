import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TenantStatusBadge } from "./tenant-status-badge";

describe("TenantStatusBadge (RF11)", () => {
  it("T22a — testando mostra cor azul", () => {
    const { container } = render(<TenantStatusBadge status="testando" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveStyle({ color: "#1d4ed8" });
    expect(badge).toHaveStyle({ background: "#dbeafe" });
  });

  it("T22b — ativa mostra cor verde", () => {
    const { container } = render(<TenantStatusBadge status="ativa" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveStyle({ color: "#15803d" });
    expect(badge).toHaveStyle({ background: "#dcfce7" });
  });

  it("T22c — travada mostra cor vermelha", () => {
    const { container } = render(<TenantStatusBadge status="travada" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveStyle({ color: "#b91c1c" });
    expect(badge).toHaveStyle({ background: "#fee2e2" });
  });

  it("exibe texto correto por status", () => {
    render(<TenantStatusBadge status="testando" />);
    expect(screen.getByText("Testando")).toBeInTheDocument();
  });
});
