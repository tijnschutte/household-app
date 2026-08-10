// The Geld page as a screen holds it: what `data.ts` assembles and what the
// components render, named in one place that neither of them owns.
//
// Separate from data.ts because that module opens with `import prisma`. These
// types are imported by `"use client"` components, and a type import is erased
// — but only if nobody ever reaches past it for a value, which is a convention
// a reader has to keep rather than a rule a tool can check. Splitting the
// shapes out is what lets `.dependency-cruiser.cjs` check it instead.

import type { MonthFigures } from "@/src/lib/geld/summary";
import type { RecurringKind } from "@/src/lib/geld/recurring-kind";

/**
 * One line on the month's checklist. `entry` is that item's MonthEntry for the
 * month when it has been paid — entering an amount IS paying it, there is no
 * separate flag — and null when it has not.
 */
export type GeldItem = {
  id: number;
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
  activeTo: string | null;
  entry: { id: number; amountCents: number; paidAt: Date } | null;
};

/** A one-off correction to the pot, already signed: a negative amount subtracts. */
export type GeldAdjustment = {
  id: number;
  amountCents: number;
  note: string | null;
  createdAt: Date;
};

/** Everything one month's screen renders. The figures come from `summarizeMonth`. */
export type GeldMonth = {
  month: string;
  contributions: GeldItem[];
  expenses: GeldItem[];
  adjustments: GeldAdjustment[];
} & MonthFigures;

/** A recurring item in the beheer sheet, where ended ones are listed too. */
export type RecurringItemRow = {
  id: number;
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
  activeTo: string | null;
  /** Whether it has ever been paid, which decides it can be ended but not deleted. */
  hasEntries: boolean;
};
