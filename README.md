<h1 align="center">Mandje</h1>
<p align="center">A shared grocery list for households — built as a real app my household actually uses</p>

<p align="center">
  <a href="https://household-app-seven.vercel.app">Live demo →</a>
</p>

## What it does

Two or more people share a household. Anyone can add items, drop them into categories, and check them off while shopping — checked items stay visible, struck through at the bottom of their category, and everyone's phone keeps up without a manual refresh. Each person also gets a personal list alongside the shared one, and a Geld tab for splitting the household's recurring costs.

The target device is a phone in a shopping aisle, not a desktop browser, so it installs as a PWA and pushes to your housemates when something lands on the list.

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
| `src/lib/`        | Server actions, database access, and the pure logic worth testing   |
| `tests/`          | Shared fixtures and setup; unit tests sit beside their source       |

Components never import server actions directly — the page that renders them passes the actions in, which is what lets a test hand them a fake instead.

## Checks

```bash
bun run verify   # typecheck, lint, format, architecture, knip, unit tests
```

This is the fast gate. It runs in seconds and needs nothing running; `typecheck` and `lint` also run on commit via husky.

`bun run e2e` is the slow one, and it catches what `verify` structurally cannot: none of those tools render an async Server Component, so a page that fails to serialize its props — and therefore never renders at all — passes every one of them. Playwright hits a real production build instead. It needs a migrated database (`bun run db:up && bun run db:migrate`) but no seed, since each spec creates and cleans up its own accounts.

## Notifications

Adding something to the shared list, or joining a household, pushes a notification to the other members — Web Push, so it reaches a phone with the app closed. Each person picks which topics they want on the Huis page; the choice follows the person across their devices, while granting permission is per device.

Without VAPID keys notifications are simply off, and the server says so once at startup. To turn them on locally:

```bash
bunx web-push generate-vapid-keys   # then fill in the VAPID_* vars in .env
```

Two things to know:

- **iOS only delivers Web Push to an installed PWA.** In Safari-as-a-browser the switch is disabled and says to add Mandje to the home screen first.
- **The service worker is disabled in `next dev`**, so notifications cannot be tested with `bun run dev`. Use `bun run build && AUTH_TRUST_HOST=true bun run start` (NextAuth needs that variable outside Vercel).

How the keys are scoped across environments, and what breaks when they are rotated, is in [docs/notifications.md](docs/notifications.md).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL (Neon) · NextAuth 5 · Tailwind CSS 4 + shadcn/ui · dnd-kit · Zod · deployed on Vercel, package-managed with Bun.
