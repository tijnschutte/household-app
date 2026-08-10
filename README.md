<h1 align="center">Mandje</h1>
<p align="center">A shared grocery list for households — built as a real app my household actually uses</p>

<p align="center">
  <a href="https://household-app-seven.vercel.app">Live demo →</a>
</p>

## What it does

Two or more people share a household. Anyone can add items, drop them into categories, and check them off while shopping — checked items stay visible, struck through at the bottom of their category, and everyone's phone keeps up without a manual refresh.

The target device is a phone in a shopping aisle, not a desktop browser, so it installs as a PWA and pushes to your housemates when something lands on the list.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL (Neon) · NextAuth 5 · Tailwind CSS 4 + shadcn/ui · dnd-kit · Zod · Web Push · deployed on Vercel, package-managed with Bun.

## Features

| Feature                   | What it does                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared list** (`/home`) | The household's boodschappenlijst: add items, drag them between categories, check them off. Polls every 10 seconds, so every phone keeps up |
| **Personal list**         | A second list on the same screen that only its owner sees, for what nobody else is shopping for                                             |
| **Geld** (`/geld`)        | The household pot: recurring costs, what has been paid this month, corrections, and who owes what                                           |
| **Huis** (`/huis`)        | Members and the join code, which optional tabs you want on your bar, and your notification settings                                         |
| **Accounts & households** | Sign up, then found a household or join one with its code. Every query is scoped to the caller's household or their own rows                |
| **PWA**                   | Installs to the home screen and runs standalone — a service worker handles caching and push                                                 |
| **Notifications**         | Web Push to the rest of the household when something happens (below)                                                                        |

### Notifications

Adding an item to the shared list, or joining a household, pushes to everyone else in it — the actor is left out, and so is anyone who muted that topic. Topic choices follow the person across their devices; granting permission is per device. Delivery runs in `after()`, so it never delays or fails the action that raised it, and never throws.

A push carries its topic as the notification tag, so five items in a row collapse into one row in the tray instead of stacking; tapping it opens the app at the right tab, re-using a window that is already open. Endpoints the push service reports as dead (404/410) are deleted as we go. A 403 is not treated as death — it usually means a wrong key — so the client instead compares the key its subscription was made with against the one in use, and trades in a stale one on the next visit.

Source: `src/lib/notifications/` for who gets what and how it is sent, `worker/index.ts` for what the phone renders, `src/components/notifications/` for the settings card.

## Running it locally

You need [Bun](https://bun.sh) and Docker running — Docker hosts the Postgres database, and nothing else has to be installed by hand.

```bash
cp .env.example .env
bun install
bun run dev:fresh
```

That starts Postgres in Docker, builds the schema, fills it with demo data, and opens the app on **http://localhost:3000**. The defaults in `.env.example` work as-is; the database URL already matches the Docker service.

Use `bun run dev:fresh` for a first run or whenever you want a clean slate — it wipes the database and reseeds. Day to day, `bun run dev:local` is the one you want: same thing, but it keeps whatever you already have in there.

### Logging in

The demo data gives you a household **Testhuishouden** (join code `LOCALDEV1234`) with two members, **Sam** and **Robin**, both with password `password`. You get four categories of groceries with a couple already checked off, a personal list for Sam, and a part-paid current month in Geld.

To watch the sync, log in as Sam in one browser and Robin in another — the list polls every 10 seconds.

### The database commands on their own

`db:up` and `db:down` start and stop Postgres, `db:migrate` applies the schema, `db:seed` loads the demo data, `db:reset` wipes and redoes all three, and `db:studio` opens a browser UI onto the data.

## Where things live

| Path              | What's in it                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `src/app/`        | Routes. A page fetches data and passes server actions down as props |
| `src/components/` | The UI. `ui/` is vendored shadcn; the rest is ours                  |
| `src/lib/`        | One folder per subject, plus the few leaves they all share          |
| `tests/`          | Shared fixtures and setup; tests sit beside their source            |

Under `src/lib/` each subject owns its own writes, reads and shapes, and is named for what it is about rather than for what kind of file it holds:

| Folder           | What it is about                                                     |
| ---------------- | -------------------------------------------------------------------- |
| `house/`         | The boodschappenlijst: both lists, categories, ordering, ownership   |
| `geld/`          | The household pot: recurring items, months, corrections, the balance |
| `membership/`    | Founding, joining and leaving a household; who is in one             |
| `account/`       | Signing up, and what a valid credential is                           |
| `modules/`       | Which tabs exist and which of them a person has switched off         |
| `notifications/` | Topics, who a push goes to, and getting it there                     |

Within a folder the file names say the role: `actions.ts` writes, `data.ts` reads, `view.ts` holds the shapes a screen renders, `schema.ts` says what input is accepted. Everything else at the top of `src/lib/` is a leaf they share — the error contract, the session, the Prisma client under `db/`.

Components never import server actions directly — the page that renders them passes the actions in, which is what lets a test hand them a fake instead. They never import a `data.ts` either: those open with `import prisma`, so a screen takes its types from the `view.ts` beside it.

## Checks

```bash
bun run verify   # typecheck, lint, format, architecture, knip, unit tests
```

This is the fast gate. It runs in seconds and needs nothing running; `typecheck` and `lint` also run on commit via husky.

Two more gates need something running, and each catches what `verify` structurally cannot:

```bash
bun run test:integration   # server actions against a real Postgres
bun run e2e                # a real request to a real production build
```

`test:integration` guards the rule the whole layering exists to protect: every query is confined to the caller's own household or their own rows. That rule lives in `where` clauses and unique constraints, so only a database can evaluate it — delete one and every check above stays green while one household starts editing another's list. It uses a throwaway `mandje_test` database, which the command creates and migrates for you.

`bun run e2e` is the slow one. None of the tools above render an async Server Component, so a page that fails to serialize its props — and therefore never renders at all — passes every one of them. Playwright hits a real production build instead. It needs a migrated database (`bun run db:up && bun run db:migrate`) but no seed, since each spec creates and cleans up its own accounts.

## Notifications locally

Without VAPID keys notifications are simply off, and the server says so once at startup. To turn them on:

```bash
bunx web-push generate-vapid-keys   # then fill in the VAPID_* vars in .env
```

Two things to know:

- **iOS only delivers Web Push to an installed PWA.** In Safari-as-a-browser the switch is disabled and says to add Mandje to the home screen first.
- **The service worker is disabled in `next dev`**, so notifications cannot be tested with `bun run dev`. Use `bun run build && AUTH_TRUST_HOST=true bun run start` (NextAuth needs that variable outside Vercel).

How the keys are scoped across environments, and what breaks when they are rotated, is in [docs/notifications.md](docs/notifications.md).
