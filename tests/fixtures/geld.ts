/**
 * Builders for the Geld domain shapes.
 *
 * A test states only the fields it is about; everything else gets a neutral
 * default. That way a test named "shows the unpaid count" contains exactly one
 * interesting number, and adding a field to GeldMonth does not touch every test.
 */

import type { GeldMonth, GeldItem, GeldAdjustment } from "@/src/lib/geld/data";
import { RecurringKind } from "@prisma/client";

export function aGeldItem(overrides: Partial<GeldItem> = {}): GeldItem {
  return {
    id: 1,
    name: "Huur",
    kind: RecurringKind.EXPENSE,
    expectedCents: 100_000,
    activeFrom: "2026-01",
    activeTo: null,
    entry: null,
    ...overrides,
  };
}

export function anAdjustment(overrides: Partial<GeldAdjustment> = {}): GeldAdjustment {
  return {
    id: 1,
    amountCents: 0,
    note: null,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  };
}

export function aGeldMonth(overrides: Partial<GeldMonth> = {}): GeldMonth {
  return {
    month: "2026-07",
    contributions: [],
    expenses: [],
    paidIn: 0,
    paidOut: 0,
    adjustments: [],
    adjustmentSum: 0,
    netto: 0,
    unpaidCount: 0,
    balanceCents: 0,
    ...overrides,
  };
}
