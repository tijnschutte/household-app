import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    // e2e/ is Playwright's; it drives a real browser and must not be collected here.
    exclude: ["node_modules/**", ".next/**", "e2e/**", ".claude/**"],
  },
  resolve: {
    // Mirrors the "@/*" -> repo root alias in tsconfig.json, so a test imports a
    // module by the same specifier the application uses.
    alias: { "@": import.meta.dirname },
  },
});
