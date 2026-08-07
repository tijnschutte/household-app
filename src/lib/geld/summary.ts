// The arithmetic behind the Geld page, over rows that have already been
// fetched. Pure: no Prisma, no request, no clock — so the meaning of "netto"
// and "op rekening" can be read, and tested, in one place.

/** A row that carries a signed amount: an adjustment, or an aggregate result. */
type Amount = { amountCents: number };

/** An item is unpaid when it has no entry for the month — entering an amount is paying it. */
type ItemWithEntries = { entries: readonly unknown[] };

export type MonthFigures = {
  paidIn: number;
  paidOut: number;
  adjustmentSum: number;
  netto: number;
  unpaidCount: number;
  balanceCents: number;
};

export type MonthFiguresInput = {
  /** Prisma's `_sum` is null for an empty set, which is a zero total here. */
  paidInCents: number | null;
  paidOutCents: number | null;
  adjustments: readonly Amount[];
  items: readonly ItemWithEntries[];
  allTimeContributionCents: number | null;
  allTimeExpenseCents: number | null;
  allTimeAdjustmentCents: number | null;
};

export function summarizeMonth(input: MonthFiguresInput): MonthFigures {
  const paidIn = input.paidInCents ?? 0;
  const paidOut = input.paidOutCents ?? 0;
  const adjustmentSum = input.adjustments.reduce((sum, a) => sum + a.amountCents, 0);

  return {
    paidIn,
    paidOut,
    adjustmentSum,
    // An adjustment is already signed, so it adds; a correction downwards is a
    // negative amountCents rather than a separate subtraction.
    netto: paidIn - paidOut + adjustmentSum,
    unpaidCount: input.items.filter((item) => item.entries.length === 0).length,
    // All-time, across every month — this is "op rekening (nu)", not the
    // balance at the end of the month being viewed.
    balanceCents:
      (input.allTimeContributionCents ?? 0) -
      (input.allTimeExpenseCents ?? 0) +
      (input.allTimeAdjustmentCents ?? 0),
  };
}

/** The figures for a household that has not set anything up yet. */
export const EMPTY_MONTH_FIGURES: MonthFigures = summarizeMonth({
  paidInCents: null,
  paidOutCents: null,
  adjustments: [],
  items: [],
  allTimeContributionCents: null,
  allTimeExpenseCents: null,
  allTimeAdjustmentCents: null,
});
