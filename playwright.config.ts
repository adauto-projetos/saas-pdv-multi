import { defineConfig, devices } from "@playwright/test";

// E2E: sobe o `npm run dev` e dirige o navegador no fluxo real (form -> server
// action -> sessão -> RLS -> banco). Requer Postgres no ar (docker compose up -d).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
