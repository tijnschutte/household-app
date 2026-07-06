# Mandje — Improvement Plan

Implementation-ready plan for improving the household grocery app. Written for implementing agents: each work package (WP) is self-contained with files, spec, and acceptance criteria. Read this whole file before starting any WP.

## Ground rules for implementing agents

- **Package manager**: `bun` (lockfile `bun.lock`; do not reintroduce pnpm). Dev server: `bun run dev`. Verify every WP with `bun run build` (must pass) and by exercising the flow in the running app.
- **Also run before finishing**: `bun run typecheck` and `bun run lint` — a husky pre-commit hook (lint-staged/Prettier + typecheck + ESLint) blocks any commit that fails them.
- **Local dev DB**: Postgres runs in Docker (`bun run db:up`, defined in `docker-compose.yml`), `DATABASE_URL` in `.env` points at it. Seed with `bun run db:seed` → user `Tijn` / password `password`, household `CD26`. Migrations: `bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel src/lib/db/schema.prisma --script` into a new folder under `src/lib/db/migrations/`, then `bunx prisma migrate deploy` (plain `prisma migrate dev` fails in non-interactive shells). Never point `DATABASE_URL` at the Neon URL commented in `.env`.
- **UI language is Dutch** — all user-facing strings, including new toasts and empty states. Code, comments, and identifiers in English.
- **Mobile-first**: this app is used as a PWA on phones. Test at ~390px viewport width. Touch targets ≥ 44px. Desktop just needs to not break (max-w-2xl centered layout).
- **Conventions**: server actions in `src/lib/actions.ts` (mutations) and `src/lib/data.ts` (reads); form-based actions return `{success, message}` via `executeAction()`; Zod schemas in `src/lib/schema.ts` with Dutch messages; shadcn/ui components in `src/components/ui/`.
- **Schema changes**: see the Local dev DB bullet above (migrate diff + deploy). Only WP-1 touches the schema.
- **Do not add new dependencies** unless a WP explicitly says so. Everything needed (dnd-kit, sonner, zod, shadcn primitives) is installed.
- **shadcn/ui first**: build all standard controls (buttons, inputs, dialogs, popovers, dropdowns, tooltips, skeletons) from `src/components/ui/`. If a needed primitive is missing there, add it with `bunx shadcn@latest add <component>` (this is the one allowed dependency exception) instead of hand-rolling floating/overlay/focus behavior. Bespoke Tailwind is fine only for things shadcn has no primitive for (list rows, drag layers, segmented control).
- The uncommitted polling-sync code in `src/app/home/client-page.tsx` (10s interval + refetch on tab focus) is part of the baseline — keep that behavior working through every refactor.

## Target interaction model (decided)

Tap an item = check it off as **bought** (persisted via the existing `Grocery.bought` field, so it syncs to other household members' phones while shopping). Checked items sink into a collapsed "Afgevinkt" section at the bottom; a single button clears (deletes) them. The current select-then-trash flow is removed. Rename moves to an explicit affordance (pencil / swipe), never double-click.

---

## Phase 1 — Foundation (do first, in order: WP-1 → WP-2 → WP-3)

These change data flow and action signatures that later WPs build on.

### WP-1: Secure and simplify server actions

**Problem**: No server action checks authorization. Any authenticated user can delete/rename/move any grocery or category by ID, and `createGroceryItem(name, userId, householdId)` trusts client-supplied IDs. Also: duplicate checks are check-then-create races, `console.log` leaks session data, and there is dead code.

**Files**: `src/lib/actions.ts`, `src/lib/data.ts`, `src/lib/auth.ts` (read-only), `src/app/home/page.tsx`, `src/lib/db/schema.prisma`, delete dead files.

**Changes**:

1. Add a helper in `src/lib/actions.ts` (or a new `src/lib/session.ts`):
   ```ts
   async function requireUser(): Promise<{ userId: number; householdId: number | null }>;
   ```
   It calls `auth()`, throws `Error("Niet ingelogd")` if no session, and loads the user's `householdId` from the DB (do not trust a client-passed householdId anywhere).
2. Change action signatures to derive scope from the session instead of parameters:
   - `createGroceryItem(name: string, personal: boolean)` — sets `userId` (personal) or `householdId` (shared) from `requireUser()`.
   - `createCategory(name: string, personal: boolean)` — same.
   - `deleteItems(ids: number[])`, `updateGroceryCategory`, `updateGroceryName`, `deleteCategory`, `buyGroceryItem` — add a `where` scope so the mutation only touches rows belonging to the caller's household or the caller personally (e.g. `deleteMany({ where: { id: { in: ids }, OR: [{ householdId }, { userId }] } })`). For single-row `update`/`delete`, use `updateMany`/`deleteMany` with the scoped where and treat `count === 0` as an error.
   - `getGroceryList(personal: boolean)` and `getCategories(personal: boolean)` in `data.ts` — same session-derived scoping.
3. Replace check-then-create duplicate detection in `createGroceryItem`/`createCategory` with catching Prisma `P2002` (unique violation) and rethrowing the Dutch message. Add `@@unique` coverage note: the existing constraints suffice; just catch the error.
4. Add `createdAt DateTime @default(now())` to `Grocery` (used by WP-4 for stable ordering of checked items) and `updatedAt DateTime @updatedAt @default(now())` to `Grocery` and `Category`. One migration.
5. Zod-validate category names (new `categorySchema` in `src/lib/schema.ts`: trimmed, 1–30 chars, Dutch messages), mirroring `groceryItemSchema`.
6. Remove `console.log` calls in `src/app/home/page.tsx` (logs the session) and in `createHousehold`.
7. Delete dead code: `fetchHouseholds` and unused exports in `data.ts`, `getAllHouseholds`/`findHomeByUserId` in `actions.ts` (verify no imports first with grep), `src/components/button.tsx`, `src/components/sign-out.tsx`, `src/lib/zod.ts` — each only if genuinely unreferenced.

**Acceptance**: `pnpm build` passes; adding/deleting/renaming items still works in both lists; a mutation against an ID from another household is a no-op/error (verify by editing the where clause temporarily or via Prisma studio); no `console.log` of sessions.

### WP-2: Server-render initial data (faster startup)

**Problem** (wishlist: "Faster app startup"): `home/page.tsx` renders an empty shell; the client then calls two server actions from `useEffect`, so the list appears only after page load → hydration → round-trip. There's also no `loading.tsx`, so navigation feels dead.

**Files**: `src/app/home/page.tsx`, `src/app/home/client-page.tsx`, `src/app/home/loading.tsx` (new), `src/lib/data.ts`.

**Changes**:

1. Add one combined read in `data.ts`: `getHomeData(personal: boolean)` returning `{ items, categories }` (single function, two parallel Prisma queries). Use it everywhere instead of separate `getGroceryList`/`getCategories` calls; delete the separate exports if nothing else uses them.
2. In `home/page.tsx` (server component), fetch household data for the default view (`personal = false`) and pass it as `initialData` to the client page.
3. In `client-page.tsx`: initialize state from `initialData`; skip the initial client fetch for the household view. Fetch on demand when toggling to Persoonlijk (and cache both lists in state so toggling back is instant — keep two state slots keyed by view, refresh the visible one via polling).
4. Polling: keep 10s interval + visibilitychange refetch, now via `getHomeData`. Skip applying poll results while a drag or inline edit is in progress (pass a ref/flag down or lift edit state) so a silent refetch can't clobber in-flight edits. Skip the state update when the payload is deep-equal to current state (`JSON.stringify` compare is fine at this size) to avoid pointless re-renders.
5. Add `src/app/home/loading.tsx` rendering the header shell plus 5–6 `Skeleton` rows (`src/components/ui/skeleton.tsx` exists).

**Acceptance**: On a cold load of `/home`, list content is present in the server-rendered HTML (verify with view-source or curl); toggling Huishouden↔Persoonlijk shows cached data instantly after the first visit; polling still syncs a change made in a second browser within ~10s.

### WP-3: Known bug fixes

**Files**: `src/app/home/client-page.tsx`, `src/components/house/grocery-list.tsx`.

**Changes**:

1. **Selection persists across list switch** (wishlist item): clear the checked-selection/edit state whenever `showPersonal` changes. (After WP-4 the selection set is gone, but fix it now so it can land independently.)
2. **Auto-scroll**: currently scrolls to bottom on every `groceryList.length` change — including deletes and poll updates. Only scroll (smoothly) after the current user adds an item; never on delete or poll refresh. Simplest: scroll in `addItem` after the optimistic insert, remove the `useEffect` on `length`.
3. **Add is not optimistic**: `addItem` awaits the server before showing the item and locks the input (`readOnly` while pending). Make it optimistic: insert a temp item (negative temp id), clear the input immediately, keep it enabled so the user can type the next item, reconcile with the server response (replace temp id) or remove + error-toast on failure. Drop the success toast on add — the item appearing is feedback enough (keep error toasts).
4. Remove the success toast on drag-to-category too ("Item verplaatst…") — moving is visible; toasts on every routine action train users to ignore them. Keep error toasts everywhere.
5. **`isMounted` gate hides SSR content** (found during WP-2): `grocery-list.tsx` renders a spinner until a client `useEffect` fires (dnd-kit SSR/hydration guard), so the server-rendered list data is invisible until hydration — negating part of WP-2's fast first paint. Fix: render the list content (rows, categories) on the server without the `DndContext` wrapper, and only gate the _drag layer_ on mount — e.g. `isMounted ? <DndContext>…{content}…</DndContext> : content`. The items must be visible in pre-hydration HTML.

**Acceptance**: switch lists with items selected → nothing stays selected; deleting an item doesn't scroll; adding 3 items rapid-fire works without waiting; no success-toast spam on add/move.

---

## Phase 2 — Interaction redesign (WP-4 → WP-5 → WP-6; sequential, all touch the same two files)

### WP-4: Check-off model (replaces select-then-delete)

**Problem** (wishlist: "Dragging / clicking / editing items is a lot on one item"): one row currently has click=select, double-click=edit, pencil=edit, drag handle. Double-click doesn't exist on mobile, select-then-trash is a two-phase delete, and the DB's `bought` field is unused.

**Files**: `src/app/home/client-page.tsx`, `src/components/house/grocery-list.tsx`, `src/lib/actions.ts`.

**Spec**:

1. **Row anatomy** (one row = one clear affordance each):
   - Leading: round checkbox circle (visual, ~24px, whole row is the tap target for toggling).
   - Middle: item name (truncated, `first-letter:uppercase`).
   - Trailing: pencil button (rename) and drag handle (`GripVertical`), both 44px touch targets, muted color.
   - Remove `onDoubleClick` rename entirely.
2. **Tap → toggle `bought`** (optimistic): add action `setGroceryBought(id: number, bought: boolean)` (scoped per WP-1; replaces `buyGroceryItem`). Optimistically flip locally, revert + error toast on failure.
3. **Afgevinkt section**: checked items leave their category groups and render in a single collapsed section at the very bottom: header `Afgevinkt (n)` with chevron, collapsed by default, tap to expand. Rows inside are struck through, muted, tap to un-check (restores category — `categoryId` is untouched by checking). Order checked items by most recently updated first (`updatedAt desc`, from WP-1).
4. **Clear button**: inside the Afgevinkt section, full-width subtle-destructive button `Wis afgevinkte items (n)` → calls existing `deleteItems` with the bought ids → optimistic removal, single toast `n item(s) verwijderd` with an **Ongedaan maken** action in the toast (sonner supports action buttons) that re-creates them via a new `restoreItems(items)` action, restoring name/category/scope. If undo is too fiddly, ship without it and note it — do not block the WP on undo.
5. **Data**: `getHomeData` now returns bought items too (remove the `bought: false` filter); unbought sorting unchanged, bought sorted `updatedAt desc`.
6. **Remove**: `selectedItems`/`toggleSelection` plumbing, the footer trash button + badge, and the green "selected" styling.

**Acceptance**: tap checks an item off with zero perceived latency; it appears in Afgevinkt; a second browser sees the checkmark within one poll cycle; clearing deletes only bought items in the current list; unchecking restores the item to its old category; no double-click handlers remain.

### WP-5: Quick add with category (type "melk", optionally pick a category)

**Problem** (wishlist items: category-on-add + inline add per category): new items always land uncategorized and must be dragged afterwards.

**Files**: `src/app/home/client-page.tsx`, `src/components/house/grocery-list.tsx`, `src/lib/actions.ts`.

**Spec**:

1. Extend `createGroceryItem(name, personal, categoryId?: number | null)` — validate the category belongs to the same scope (household/user) server-side.
2. **Add-bar category chip**: left inside the footer input row, a small chip/select showing the target category (default: `Geen categorie`). Tapping it opens a compact popover/sheet listing categories (use the existing `Select` or a simple popover of buttons — whatever reads cleanest on mobile). The choice is _sticky_ for consecutive adds and resets to Geen categorie when switching lists.
3. **Inline add per category** (wishlist): each category section header gets a small `+` ghost button; tapping it focuses the footer input **with that category pre-selected in the chip** (don't build N inline inputs — one input, pre-targeted, keeps the DOM and focus handling simple).
4. Optimistic insert (from WP-3) must place the temp item inside the chosen category group.

**Acceptance**: add "melk" with a category chip set → lands in that category without dragging; `+` on a category header pre-selects it; category choice survives adding multiple items; server rejects a categoryId from another household.

### WP-6: Drag & category polish + swipe-to-delete

**Problem** (wishlist: empty categories as thin drop line; swipe to delete; general drag feel).

**Files**: `src/components/house/grocery-list.tsx`.

**Spec**:

1. **Empty categories**: render as a single compact row — category name + `+` button + thin dashed drop-zone line underneath (~8px tall, expands with a highlight while a drag is over it via `useDroppable`'s `isOver`). No more tall empty boxes with italic placeholder text. Same for the uncategorized zone: render it only while a drag is active or when it has items; when it appears as a drop target during drag, it's a thin labeled line.
2. **Drop-target feedback**: while dragging, the hovered category gets a visible highlight (`isOver` → ring/background change). Currently there is none.
3. **Category delete confirmation**: deleting a category currently fires instantly from a tiny trash icon. Wrap in the existing `AlertDialog` ("Categorie verwijderen? Items blijven bestaan en worden ongecategoriseerd.") — only when the category has items; empty categories delete immediately.
4. **Swipe to delete** (wishlist): implement swipe-left on a row to reveal a red `Verwijderen` action (delete that single item immediately, with the undo-toast from WP-4 if it shipped). Implement with pointer events on the row (translate-X with a threshold, snap back or snap open) — **no new dependency**. Care: the drag handle already captures pointer events for dnd-kit; restrict swipe detection to horizontal gestures starting outside the drag handle, and cancel the swipe if vertical movement dominates (scroll intent). If dnd-kit's PointerSensor conflicts irreparably, scope swipe to the row body and document it in code.
5. Keep the 250ms TouchSensor delay for drag (it distinguishes drag from scroll/swipe).

**Acceptance**: empty categories are one thin line; dragging over any category visibly highlights it; deleting a non-empty category asks for confirmation; swipe-left deletes a single item on a touch device (test in devtools touch emulation); vertical scrolling over rows still works.

---

## Phase 3 — Visual polish & secondary pages (WP-7, WP-8 parallelizable after Phase 2)

### WP-7: Visual refresh — all screens

**Problem**: The current look is noisy — a heavy blue gradient header, shadows on every element, `active:scale-95` everywhere, two large footer buttons for the list toggle, and gradient page background. It reads as assembled rather than designed. The auth pages, setup page, and info page each improvised their own layout, so nothing feels like one app.

**Scope**: every screen — home, sign-in, sign-up, household-setup, household-info. Define the design language once and apply it everywhere in this WP; WP-8/WP-9 then only change _content/structure_ on their pages, inheriting this style.

**Files**: `src/app/home/client-page.tsx`, `src/components/house/grocery-list.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/auth/sign-in-form.tsx`, `src/components/auth/sign-up-form.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/app/household-setup/household-setup-client.tsx`, `src/components/household-info.tsx`, `src/app/household-info/page.tsx`, `src/app/home/loading.tsx`.

**Spec** (calmer, flatter, content-first — read the `frontend-design` skill before implementing this WP if available):

1. **Header**: single flat brand color (keep the existing deep blue family, e.g. `bg-blue-900`) or plain white with a bottom border; drop the gradient and `drop-shadow` on the title. Height ≤ 56px. Title centered, sign-out left, info right (unchanged positions).
2. **List toggle → segmented control**: replace the two large footer buttons with a compact 2-segment control (one rounded container, sliding active pill, `House`/`User` icons + labels). Put it in the header area or directly under it — it's navigation, not an action, and shouldn't compete with the add bar. Footer keeps only the add bar.
3. **Cards/rows**: items become flat rows with a hairline separator or very subtle border (`border-gray-200`), no per-row shadow, no hover scale. Category headers: small-caps label + item count, no tinted background boxes — whitespace and a hairline are enough structure.
4. **Motion**: remove blanket `active:scale-95`/`hover:scale` classes; keep one subtle press state (`active:opacity-70` or background change). Add `transition` only where state actually changes (check-off strikethrough, section collapse).
5. **Safe areas (PWA)**: footer padding `pb-[max(1rem,env(safe-area-inset-bottom))]`; verify `viewport-fit=cover` is set via Next viewport config if needed.
6. **Empty state**: keep the basket icon empty state, tone it to the new style.
7. Keep Poppins, keep the blue-900 theme color, keep `sonner` position. No dark mode in this pass.
8. **Shared design tokens**: define the palette/spacing decisions once (globals.css `@theme` / a small set of utility conventions documented in a code comment) — brand blue-900, one gray scale, one border style, one radius (e.g. `rounded-xl` cards / `rounded-lg` controls), consistent focus ring.
9. **Auth pages (sign-in, sign-up)**: same flat card on a plain background (no gradient), app name "Mandje" + basket mark above the card as a brand moment, consistent input heights (h-12 to match home add-bar), full-width primary submit, link to the other auth page styled as a quiet text link. Keep all existing validation/UX logic untouched.
10. **Household-setup + household-info**: apply the same card style, page padding, and button hierarchy (these pages get structural changes in WP-8/WP-9 — here only restyle what exists; if WP-8/WP-9 already landed, restyle their output).
11. **Consistency sweep**: after styling, compare all five screens at 390px — same page background, same card treatment, same heading scale, same primary-button look everywhere.

**Acceptance**: no gradients or per-row shadows remain anywhere; toggle is a segmented control not two buttons; all five screens share background, card, heading, and button styles (side-by-side screenshots at 390px look like one app); nothing overlaps the iOS home indicator.

### WP-8: Household info page — members + share

**Problem** (wishlist: "Show members on info page"): the info page shows only the secret code.

**Files**: `src/lib/data.ts`, `src/components/household-info.tsx`, `src/app/household-info/page.tsx`.

**Spec**:

1. `getHouseholdById` → extend (or add `getHouseholdWithMembers`) to `include: { members: { select: { id, name } } }`.
2. **Members section** in the card: `Leden (n)` list — avatar circle with first letter, name, and a `jij`-badge on the current user. Above the secret-code block.
3. **Share button**: next to copy, a share button using `navigator.share({ text: \`Doe mee met "${name}" in Mandje met code ${secret}\` })` when available, hidden otherwise (feature-detect).
4. Keep leave-household flow as is.

**Acceptance**: info page lists all member names with the current user marked; share sheet opens on mobile; copy still works.

---

### WP-9: Household setup page redesign

**Problem**: The create and join forms sit stacked with equal visual weight and duplicated form chrome; the "Deelnemen" button is a near-invisible secondary variant that reads as disabled; the sign-out button floats detached in the top-left; the code placeholder is shouty uppercase mono; the subtitle is long.

**Files**: `src/app/household-setup/household-setup-client.tsx`, `src/app/household-setup/page.tsx`, `src/lib/actions.ts` (validation only).

**Spec**:

1. **One choice, then one form**: replace the stacked forms with a 2-tab segmented control (`Nieuw huishouden` / `Deelnemen`) above a single card body showing only the active form. Default tab: Deelnemen if the app ever knows an invite context, otherwise Nieuw. Both submit buttons become full-width primary (blue) — the active tab already disambiguates, so no washed-out secondary variant.
2. **Copy**: title stays; shorten the subtitle to one line ("Maak een huishouden aan of doe mee met een bestaand huishouden."). Placeholder for the code: `bijv. A1B2C3D4E5F6` (normal casing, not screaming); keep `font-mono uppercase` styling on typed input and normalize casing client-side before submit.
3. **Code input ergonomics**: `autoCapitalize="characters"`, `autoComplete="off"`, `spellCheck={false}`, `inputMode="text"`, max length 12, trim on submit. Show the inline Zod-style error under the field instead of only a toast when the code is invalid.
4. **Sign-out**: move into a small labeled ghost button ("Uitloggen") top-right of the page, outside the card, aligned with the card edge.
5. **Style**: match the WP-7 design language (flat card, hairline borders, no heavy shadows). Mobile-first: card padding ≤ 24px at 390px width.
6. Server side: joinHousehold/createHousehold should derive the userId from the session (same `requireUser()` pattern as WP-1) instead of a hidden `userId` form field.
7. **Stale-session hardening** in `src/lib/session.ts`: `requireUser()` must verify the session's user id still exists in the DB and throw `Error("Niet ingelogd")` if not (a year-long JWT can outlive its user row — e.g. after a DB switch/reset, a valid token for a deleted user currently sails through middleware and crashes later with Prisma P2018). Look up the user row itself, not just its `householdId`; treat "row missing" as unauthenticated.

**Acceptance**: only one form visible at a time; both primary buttons clearly enabled; entering a lowercase code still joins; sign-out reachable but not the first thing in the reading order; no client-supplied userId in the two actions; with a valid JWT for a nonexistent user id, every action fails with "Niet ingelogd" instead of a Prisma error.

## Sequencing & parallelism

```
WP-1 ──► WP-2 ──► WP-3 ──► WP-4 ──► WP-5 ──► WP-6
                                      │
                                      ├──► WP-7   (parallel after WP-6)
                                      └──► WP-8   (parallel anytime after WP-1)
```

WP-4/5/6/7 all edit `client-page.tsx` and `grocery-list.tsx` — do **not** run them in parallel. WP-8 only touches info-page files and can run alongside anything after WP-1.

## Wishlist coverage (from the original version of this file)

| Original item                                  | Covered by                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Real-time sync between household members       | Baseline polling, hardened in WP-2 (+ bought-state sync in WP-4) |
| Inline "add" button per category section       | WP-5                                                             |
| Swipe to delete                                | WP-6                                                             |
| Delete button persisting across list switch    | WP-3 (obsoleted by WP-4)                                         |
| Empty categories as thin drop-target line      | WP-6                                                             |
| Type "melk" and optionally pick a category     | WP-5                                                             |
| Show members on info page                      | WP-8                                                             |
| Faster app startup                             | WP-2                                                             |
| Dragging/clicking/editing is a lot on one item | WP-4                                                             |

## Final verification checklist (after all WPs)

- [ ] `pnpm build` and `pnpm lint` pass
- [ ] Two-browser test: add / check off / clear in one browser appears in the other within 10s
- [ ] Full flow on 390px viewport with touch emulation: add (with category), check off, expand Afgevinkt, clear, rename via pencil, drag between categories, swipe-delete, switch to Persoonlijk and back
- [ ] Sign up → create household → invite code join from second account → both see shared list
- [ ] No server action accepts a client-supplied userId/householdId; all mutations scoped to session
- [ ] All user-facing text is Dutch; no success-toast spam on routine actions
