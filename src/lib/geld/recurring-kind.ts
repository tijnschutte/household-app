import type { RecurringKind } from "@prisma/client";

/**
 * The two kinds of recurring item, as values a client component can name.
 *
 * Importing Prisma's generated enum as a *value* pulls its browser runtime
 * (~14 KB gzipped) into whatever bundle does it — for two strings that carry no
 * behaviour. `import type` above is erased at compile time, so the type stays
 * single-sourced from the schema while the values cost nothing.
 *
 * Server modules have Prisma loaded already and may keep using the enum
 * directly; this exists for the `"use client"` side of the boundary.
 */
export const RECURRING_KIND = {
  CONTRIBUTION: "CONTRIBUTION",
  EXPENSE: "EXPENSE",
  // Tripwire: Record demands a key per schema kind, so adding one to
  // schema.prisma stops this compiling rather than drifting silently.
} as const satisfies Record<RecurringKind, RecurringKind>;

export type { RecurringKind };
