import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // These suites cover pure modules only — no DOM, no database, no network.
    // Keep it that way: anything needing a browser belongs in a separate
    // environment so `npm test` stays fast enough to run on every commit.
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" -> "./*" alias in tsconfig.json.
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
