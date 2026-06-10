import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// jsdom é o ambiente padrão (testes de componente). Testes de banco (RLS,
// constraints) declaram `// @vitest-environment node` no topo do arquivo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Escopo: código com lógica que escrevemos. Primitivos vendored do shadcn,
      // schema declarativo e páginas/RSC (cobertos por e2e) ficam de fora.
      include: [
        "lib/**",
        "components/products/**",
        "components/ui/MoneyInput.tsx",
        "components/ui/PercentInput.tsx",
        "components/ui/QuantityInput.tsx",
      ],
      exclude: ["**/*.{test,spec}.*", "**/__tests__/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
