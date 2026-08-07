import { defineConfig } from "@playwright/test";

/**
 * The gate for failures that only exist at request time.
 *
 * `bun run verify` renders no async Server Component — typecheck, lint, arch
 * and vitest all pass on a page that cannot serialize its props and therefore
 * never renders at all. Nothing here duplicates those checks; these specs exist
 * to make a real request to a real server and look at what came back.
 *
 * Needs a migrated database (`bun run db:up && bun run db:migrate`), but no
 * seed: each spec creates the account it needs and removes it afterwards.
 */

// Its own port, so a `bun run dev` on 3000 can stay up while this runs.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // One browser, in order: these specs share one database.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL, viewport: { width: 420, height: 900 } },
  webServer: {
    // A production build, because that is where serialization is enforced and
    // where the service worker exists at all.
    command: "bun run build && bun run start",
    url: baseURL,
    // Long enough for a cold `next build`.
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      // NextAuth refuses an unrecognised host outside Vercel; without this
      // every request 307s in a loop instead of rendering.
      AUTH_TRUST_HOST: "true",
    },
  },
});
