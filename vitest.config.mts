import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Cada test levanta un Postgres (PGlite) con todas las migraciones.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
