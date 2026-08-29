# The browser pass

What a feature has to survive in a real browser before anyone calls it done,
and how to hand that pass to an agent so it happens every time rather than when
somebody remembers.

## Why it is a separate step

`bun run verify` renders no async Server Component and `test:integration` never
leaves the server. A page that fails to serialize its props, a form whose
submit button sits under the keyboard, a sheet that opens but lists nothing —
every gate above stays green. The only thing that sees those is a request to a
real build with a real browser on the other end, which is what `bun run e2e`
is. The browser pass is the rule that a feature gets one of those specs, and
that the spec drives the feature the way a household member would, end to end.

## What one pass covers

A feature is one story a person can tell: "I add a recipe, put it in the
mandje, and see it on the list." The spec tells that story in order and asserts
on what the person would see at each step — never on what the code did to get
there. One spec file per feature, in `e2e/`, following the two that exist:

- **Own data.** The spec signs up its own account and household in
  `beforeAll` and removes them via Prisma in `afterAll`. No seed, no shared
  fixtures between spec files — the suite runs with one worker against one
  database, so leftovers from one file are the next file's flaky failure.
- **Every screen the story touches**, entered the way the UI enters it: the
  FAB, not a typed URL; the pencil, not `/bewerken` by hand. A typed URL is
  fine only when that is the point (a deep link, a 404 for another
  household's row).
- **The write and its consequence on the other screen.** A recipe in the
  mandje is not done when the button turns green; it is done when `/home`
  shows the row with its quantity. The same for anything that crosses a
  module boundary.
- **The merge, not just the insert.** Do the write twice and assert on the
  second outcome (`400 g` then `800 g`, not a duplicate row). Idempotence and
  accumulation are where the real bugs live, and the unit suite can only prove
  them for the pure function, not for the row the transaction wrote.
- **Scoping from the outside.** A second household in the same spec must not
  see the first's rows, and must get a 404 on their id. `test:integration`
  proves this for the query; this proves it for the page.
- **The empty state**, since it is the first thing a new household sees and
  the last thing anyone tests by hand.

What it does not cover: notification delivery (needs a push service and an
installed PWA), and anything `verify` already catches. A spec that restates a
unit test is slower and no safer.

## Running it

```bash
bun run db:up && bun run db:migrate   # a migrated database, unseeded is fine
bun run e2e                           # builds, starts on :3100, runs e2e/
```

The config reuses a server already on `:3100` outside CI, so on a second run
only the specs pay. If a change touched the server side, stop that server
first or the pass runs against a stale build.

## Handing it to an agent

The pass is a good subagent task: it is self-contained, its result is a
pass/fail line, and it needs no design decisions — those were made when the
feature was specified. The brief has to carry three things or the agent will
invent them:

1. **The story**, step by step, with what the person sees at each one. Write it
   as the numbered list above, not as "test the recipe feature".
2. **What is fixed.** The screens, labels and behaviours the design settled on,
   so a failing assertion is fixed in the application and not by moving the
   assertion. Say so explicitly: _fix the defect, not the test; if a failure is
   a design question, leave it and report it_.
3. **The gates it must leave green**: `bun run e2e`, then `bun run verify` and
   `bun run test:integration`, since a fix on the server side can regress
   either.

Ask for a report of each defect and its fix, the final pass/fail lines, and
anything left open. Read the report against the design before believing it —
the agent proves the story it was told, not the one that was meant.

A feature is done when its spec is in `e2e/`, the pass is green, and the report
has been read. Not before.
