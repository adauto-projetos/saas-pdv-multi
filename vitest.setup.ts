import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";

// Carrega .env.local para os testes que tocam o banco (DATABASE_URL etc.).
config({ path: ".env.local" });
