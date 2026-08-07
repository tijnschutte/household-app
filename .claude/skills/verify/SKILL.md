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

No `"use client"` component imports a server action any more, so every one of
them renders in a test. Keep it that way: a component that imports from
`lib/actions` or `lib/geld/actions` pulls Prisma into the test process and
becomes unrenderable.

The pattern throughout is that a component exports the operations it needs and
the server page supplies them — ordinary Next, and a test passes a fake instead
of reaching for `vi.mock`. Both routes are worked examples:

- **Geld** — `ItemSectionActions`, `AdjustmentsSectionActions` and
  `BeheerSheetActions` union into `GeldActions` in `geld-page-client.tsx`;
  `(tabs)/geld/page.tsx` names the eight real actions.
- **Home** — `HomeActions` in `client-page.tsx` (it includes `onLoadData`,
  since polling `getHomeData` is a server action too); `(tabs)/home/page.tsx`
  names the nine.

Pure logic lives under `src/lib/`, not in the components: `geld/money.ts` and
`geld/summary.ts`, `house/grocery-order.ts` (ordering and grouping) and
`house/grocery-view.ts` (the optimistic list transforms and the add-bar name
rules). Reach for those before writing a new transform inline.

`tests/setup.ts` also stands in for `next-auth/react`, because `signIn`/`signOut`
are client-only and a server page cannot hand them down.

## Proving the tests are armed

A green suite proves nothing on its own: a test that cannot fail is not a test.
Before claiming a behaviour is covered, break it on purpose and watch the suite
go red. This is the cheapest way to catch an assertion that was passing for the
wrong reason, and it belongs in the loop — not in a review at the end, which
cannot see it.

```bash
SRC=src/components/geld/adjustments-section.tsx
TEST=src/components/geld/adjustments-section.test.tsx
cp "$SRC" /tmp/mutant.bak

# Replace exactly one behaviour, then expect failures.
python3 - "$SRC" 'cents * sign' 'cents' <<'PY'
import io, sys
path, before, after = sys.argv[1], sys.argv[2], sys.argv[3]
source = io.open(path, encoding="utf-8").read()
assert before in source, "anchor not found: " + before
io.open(path, "w", encoding="utf-8").write(source.replace(before, after, 1))
PY

bunx vitest run "$TEST"          # must report failures
cp /tmp/mutant.bak "$SRC"        # always restore
bunx vitest run "$TEST"          # must be green again
```

Mutate the *decision*, not the syntax: flip a sign, drop a guard, hardcode an
id, remove a fallback. One mutation per run, and restore before the next — the
`assert` on the anchor is there because a silently-missed replacement looks
exactly like a passing mutation.

**Restore from the `cp` backup, never with git.** `git checkout -- <file>` and
`git restore` do not know which edit was yours: they revert the file to its last
committed state, taking every uncommitted change with it. Run one against a file
you are mutating and you delete work that was never committed and is therefore
not in the object store — no reflog, no recovery. The `cp` is the whole safety
model, so keep the backup and put it back yourself.

If you are reviewing rather than implementing, do not run this at all. Mutating
shared source under another agent invalidates its read, and a probe is not worth
a race. Report that the arming evidence is missing and let the author produce it.

Three failure modes worth knowing:

- **Prettier reformats the code you are trying to anchor on.** A signature that
  fits on one line in your head may span four in the file. Read the source
  before writing the anchor.
- **Piping to `grep -q` lies.** `grep -q` exits on first match, SIGPIPEs the
  producer, and under `set -o pipefail` the pipeline reports 141 — so a
  *working* rule looks broken. Capture into a variable and grep that instead.

## Checking a change by hand

A green suite is not evidence that a user-visible change works end to end.
Exercise the real flow in the browser, and say in your report which flow you
drove and what you saw.

The UI is Dutch. Two tabs (`Huis`, `Geld`) plus a header button for household
settings; mutations are server actions, so a change that "does nothing" in the
browser is usually an action returning `{success: false}` with the message
swallowed rather than a client bug — check the dev server console.

## Gotchas

Repo-wide:

- `next build` regenerates `public/sw.js` and `public/workbox-*.js`. Those are
  ignored by prettier, eslint and knip on purpose; never hand-edit them and
  never report findings in them. After a build, `git checkout -- public/sw.js`
  rather than committing minifier churn.
- `src/components/ui/` is vendored shadcn. It keeps the full upstream API
  deliberately, so unused exports there are not dead code.
- Path aliases are `@/*` -> repo root, so library imports read
  `@/src/lib/...`, not `@/lib/...`.
- `typecheck` does not validate that a server action survives serialization
  across the RSC boundary. Only `bun run build` does. Run it after changing how
  actions reach a client component.

In tests:

- `Intl` separates the euro symbol with a **non-breaking space** (U+00A0), but
  Testing Library normalizes that to a plain space before matching. So a DOM
  query writes `"€ 25,00"` with an ordinary space, while an exact-string
  assertion in `money.test.ts` needs the real NBSP. They differ on purpose.
- Radix dialogs stay mounted and are opened by a controlled `open` prop, which
  does **not** fire `onOpenChange`. Anything that must reset on open needs an
  effect; anything that must reset on close needs every close path to go
  through one function, including the "Annuleren" button.
- A collapsed element is often still in the DOM. The clear-basket bar animates
  via Tailwind height/opacity, so `queryByText` finds it either way — assert on
  the behaviour (clearing an empty basket deletes nothing) rather than presence.

In server actions:

- `restoreItems` defaults `bought` to **`true`** when the field is omitted,
  because the clear-basket flow restores items as still-bought. A swipe-deleted
  unbought row must pass `bought: false` explicitly. `snapshotForRestore` in
  `house/grocery-view.ts` always sets it, so use that rather than building the
  snapshot inline.

In `.dependency-cruiser.cjs`:

- `doNotFollow` stops the crawl at a module but keeps it in the graph;
  `exclude` drops it entirely. Putting `node_modules` in `exclude` silently
  disarms every rule that names a package — the rule still reports "no
  violations", because it can no longer see anything to violate it.
