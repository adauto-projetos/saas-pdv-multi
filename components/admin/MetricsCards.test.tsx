import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricsCards } from "./MetricsCards";

describe("MetricsCards (RF06)", () => {
  it("T12 — exibe contagens corretas por status", () => {
    render(<MetricsCards stats={{ testando: 2, ativa: 5, travada: 1 }} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("exibe labels de status", () => {
    render(<MetricsCards stats={{ testando: 0, ativa: 0, travada: 0 }} />);
    expect(screen.getByText(/testando/i)).toBeInTheDocument();
    expect(screen.getByText(/ativas/i)).toBeInTheDocument();
    expect(screen.getByText(/travadas/i)).toBeInTheDocument();
  });
});
