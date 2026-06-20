import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ADD tooling (gitignored, não é código da aplicação):
    ".claude/**",
    ".codeadd/**",
    // Design reference files — não são código da aplicação:
    "Design funcional e moderno/**",
    "Redesign do PDV/**",
    "docs/design/**",
    "components/PDVApp.jsx",
    "components/PDVApp.css",
  ]),
]);

export default eslintConfig;
