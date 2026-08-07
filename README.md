<h1 align="center">Mandje</h1>
<p align="center">A shared grocery list for households — built as a real app my household actually uses</p>

<p align="center">
  <a href="https://household-app-seven.vercel.app">Live demo →</a>
</p>

## What it does

Two or more people share a household. Anyone can add items, drop them into categories, and check them off while shopping. Checked items stay visible (struck through, sunk to the bottom of their category). Everyone's phone stays in sync without a manual refresh. Each person also gets a personal list alongside the shared one.

Installable as a PWA; the target device is a phone in a shopping aisle, not a desktop browser.

## Features

- Shared household list + personal list, toggled with one tap
- Categories with drag-and-drop, inline rename, swipe-to-delete
- Check off in place, undo on delete/clear
- Quick-add with a sticky "add to this category" picker
- Join a household via a shareable code; members list on the info page
- Real-time-ish sync across devices (polling)
- Installable PWA with offline-capable service worker

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma + PostgreSQL (Neon) · NextAuth 5 · Tailwind CSS 4 + shadcn/ui · dnd-kit · Zod · deployed on Vercel, package-managed with Bun.

## Running it locally

Copy `.env.example` to `.env`, then:

```bash
bun install
bun run dev:local   # postgres in docker + migrations + the app
```

`dev:local` keeps whatever is already in your database. `bun run dev:fresh` wipes it and reseeds instead — use that for a clean slate. The individual steps (`db:up`, `db:migrate`, `db:seed`, `db:reset`, `db:down`, `db:studio`) are still there if you want them one at a time.

The seed gives you a household "CD26" (join code `LOCALDEV1234`) with two members, **Tijn** and **Dirk**, both with password `password`. It fills the shared list with four categories of groceries — a couple already checked off — a personal list for Tijn, and a part-paid current month in Geld. To see the cross-device sync, log in as Tijn in one browser and Dirk in another; the list polls every 10 seconds.

`bun run typecheck` and `bun run lint` run automatically on commit via husky.

## Checks

`bun run verify` is the fast gate: typecheck, lint, format, architecture, knip, unit tests. It runs in seconds and needs nothing running.

`bun run e2e` is the slow one, and it exists for the failures `verify` structurally cannot see. None of those tools render an async Server Component, so a page that fails to serialize its props — and therefore never renders at all — passes every one of them. Playwright makes a real request to a real production build and looks at what came back. It needs a migrated database (`bun run db:up && bun run db:migrate`) but no seed: each spec creates the accounts it needs and deletes them afterwards.
