---
name: verify
description: The automated gates for household-app, and how to run the app to check a change by hand. Use before claiming a change works.
---

# Verifying household-app

## The gates

```bash
bun run verify     # typecheck -> lint:check -> format:check -> arch -> knip:ci -> test:run
```

Run this before claiming anything is done. The six gates are:

| Gate           | Command                                  | Catches                                               |
| -------------- | ---------------------------------------- | ----------------------------------------------------- |
| `typecheck`    | `tsc --noEmit`                           | type errors                                           |
| `lint:check`   | `eslint`                                 | `next/core-web-vitals` + `next/typescript` rules       |
| `format:check` | `prettier --check .`                     | formatting                                            |
| `arch`         | `depcruise` vs `.dependency-cruiser.cjs` | import-boundary violations between app/components/lib |
| `knip:ci`      | `knip`                                   | unused files, exports and dependencies                |
| `test:run`     | `vitest run`                             | unit and component tests                              |

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

## Writing tests

Vitest with happy-dom and React Testing Library. Tests sit beside their source
(`money.ts` / `money.test.ts`); shared builders live in `tests/fixtures/`.

```bash
bun run test            # watch
bun run test:run        # once, as verify does
bunx vitest run src/lib/geld/money.test.ts
```

`tests/setup.ts` handles the DOM matchers, unmounting the previous render, and
the App Router hooks — a component that navigates gets a working `useRouter`,
and a test asserts on it by importing `useRouter` from `next/navigation`.
Nothing there stands in for our own code.

Two limits. **Async Server Components cannot be rendered** by Testing Library,
so `src/app/**/page.tsx` is out of reach — that is what Playwright is for.

And a `"use client"` component that imports a server action directly pulls
Prisma into the test process, so it cannot be rendered here at all. Eight still
do: `item-section.tsx`, `adjustments-section.tsx`, `beheer-sheet.tsx`,
`add-category.tsx`, `household-info.tsx`, `auth/sign-up-form.tsx`,
`(tabs)/home/client-page.tsx` and `household-setup/household-setup-client.tsx`.

The fix is to take the action as a prop from the server page, which is ordinary
Next, and let the test pass a fake. Do that to the component you are touching
rather than reaching for `vi.mock`. `house/grocery-list.tsx` already works this
way — every mutation reaches it as an `on*` callback — which is why it is
testable despite being the largest component here.

## Checking a change by hand

A green suite is not evidence that a user-visible change works end to end.
Exercise the real flow in the browser, and say in your report which flow you
drove and what you saw.

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
