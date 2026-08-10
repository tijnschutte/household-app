import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Mirrors the "@/*" -> repo root alias in tsconfig.json, so a test imports a
// module by the same specifier the application uses.
const alias = { "@": import.meta.dirname };

// e2e/ is Playwright's; it drives a real browser and must not be collected here.
const neverCollected = ["node_modules/**", ".next/**", "e2e/**", ".claude/**"];

/**
 * Two suites, split by what they need to run.
 *
 * `unit` needs nothing: pure logic and components, fakes at every port, so it
 * stays in `bun run verify` as the fast gate. `integration` needs a migrated
 * Postgres, because the rule it guards — every query is scoped to its caller —
 * lives in `where` clauses and constraints that only a database can evaluate.
 * It runs on its own command for the same reason `e2e` does.
 */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          globals: true,
          environment: "happy-dom",
          setupFiles: ["./tests/setup.ts"],
          include: ["**/*.test.{ts,tsx}"],
          exclude: [...neverCollected, "**/*.integration.test.ts"],
          // Next inlines NEXT_PUBLIC_* at build time; under vitest the module reads
          // it at import, so the notification settings need a value to consider push
          // configured at all.
          env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "a-test-vapid-key" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          include: ["**/*.integration.test.ts"],
          exclude: neverCollected,
          // One database, truncated between tests, so two files must not
          // interleave against it.
          fileParallelism: false,
          // Never the development database: these tests truncate every table.
          // `setup.ts` refuses to run against a name that does not end in _test.
          env: {
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              "postgresql://postgres:postgres@localhost:5432/mandje_test",
          },
        },
      },
    ],
  },
});
