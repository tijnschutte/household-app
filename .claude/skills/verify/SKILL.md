---
name: verify
description: The automated gates for household-app, and how to run the app to check a change by hand. Use before claiming a change works.
---

# Verifying household-app

## The gates

```bash
bun run verify     # typecheck -> lint:check -> format:check -> arch -> knip:ci
```

Run this before claiming anything is done. The five gates are:

| Gate           | Command                                  | Catches                                               |
| -------------- | ---------------------------------------- | ----------------------------------------------------- |
| `typecheck`    | `tsc --noEmit`                           | type errors                                           |
| `lint:check`   | `eslint`                                 | `next/core-web-vitals` + `next/typescript` rules       |
| `format:check` | `prettier --check .`                     | formatting                                            |
| `arch`         | `depcruise` vs `.dependency-cruiser.cjs` | import-boundary violations between app/components/lib |
| `knip:ci`      | `knip`                                   | unused files, exports and dependencies                |

`knip` is green as of the dependency cleanup that removed 15 unused packages.
Read `knip.json` before adding an ignore — vendored shadcn and config-only
dependencies are already accounted for, and a new entry usually means the code
is genuinely dead.

A PostToolUse hook (`.claude/hooks/verify-file.sh`) already runs prettier,
eslint and tsc on every file you Write or Edit, so `bun run verify` should
usually pass first time. It does not run `arch` — that is per-graph, not
per-file, so an import boundary you broke only shows up here or at commit time.

## Running it

Needs Postgres. The database is a docker compose service:

```bash
bun run db:up        # docker compose up -d db
bun run db:migrate   # prisma migrate dev
bun run db:seed      # optional fixtures
bun run dev          # next dev --turbopack, http://localhost:3000
```

Auth is next-auth v5 with credentials, so a signed-out browser lands on
`/sign-in`. Seeded users come from `src/lib/db/seed.ts` — read it for the
credentials rather than guessing.

## Checking a change by hand

There is **no test suite** in this repo — no vitest, no Playwright specs.
`@playwright/test` is installed but unused. So "the types pass" is not evidence
that a user-visible change works: exercise the real flow in the browser, and say
in your report which flow you drove and what you saw.

The UI is Dutch. Two tabs (`Huis`, `Geld`) plus a header button for household
settings; mutations are server actions, so a change that "does nothing" in the
browser is usually an action returning `{success: false}` with the message
swallowed rather than a client bug — check the dev server console.

## Gotchas

- `next build` regenerates `public/sw.js` and `public/workbox-*.js`. Those are
  ignored by prettier, eslint and knip on purpose; never hand-edit them and
  never report findings in them.
- `src/components/ui/` is vendored shadcn. It keeps the full upstream API
  deliberately, so unused exports there are not dead code.
- Path aliases are `@/*` -> repo root, so library imports read
  `@/src/lib/...`, not `@/lib/...`.
