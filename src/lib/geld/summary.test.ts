import { describe, it, expect } from "vitest";
import { summarizeMonth, EMPTY_MONTH_FIGURES, type MonthFiguresInput } from "./summary";

/** A month where nothing has happened; each test states only what it is about. */
function input(overrides: Partial<MonthFiguresInput> = {}): MonthFiguresInput {
  return {
    paidInCents: null,
    paidOutCents: null,
    adjustments: [],
    items: [],
    allTimeContributionCents: null,
    allTimeExpenseCents: null,
    allTimeAdjustmentCents: null,
    ...overrides,
  };
}

describe("summarizeMonth", () => {
  describe("empty aggregates", () => {
    it("reads Prisma's null sum as zero rather than NaN", () => {
      // `_sum.amountCents` is null when no row matched. Arithmetic on null
      // would coerce to 0 here but to NaN elsewhere, so it is pinned.
      const figures = summarizeMonth(input());

      expect(figures.paidIn).toBe(0);
      expect(figures.paidOut).toBe(0);
      expect(figures.netto).toBe(0);
      expect(figures.balanceCents).toBe(0);
      expect(Number.isNaN(figures.netto)).toBe(false);
      expect(Number.isNaN(figures.balanceCents)).toBe(false);
    });

    it("treats a null all-time sum as zero on one side only", () => {
      const figures = summarizeMonth(
        input({ allTimeContributionCents: 50_000, allTimeExpenseCents: null })
      );

      expect(figures.balanceCents).toBe(50_000);
    });
  });

  describe("netto", () => {
    it("is what came in, less what went out", () => {
      const figures = summarizeMonth(input({ paidInCents: 120_000, paidOutCents: 45_000 }));

      expect(figures.netto).toBe(75_000);
    });

    it("goes negative when the month spent more than it took in", () => {
      const figures = summarizeMonth(input({ paidInCents: 10_000, paidOutCents: 25_000 }));

      expect(figures.netto).toBe(-15_000);
    });

    it("adds a signed adjustment rather than subtracting it", () => {
      const figures = summarizeMonth(
        input({
          paidInCents: 100_000,
          paidOutCents: 0,
          adjustments: [{ amountCents: -2_500 }, { amountCents: 1_000 }],
        })
      );

      expect(figures.adjustmentSum).toBe(-1_500);
      expect(figures.netto).toBe(98_500);
    });
  });

  describe("unpaidCount", () => {
    it("counts only items with no entry for the month", () => {
      const figures = summarizeMonth(
        input({
          items: [{ entries: [] }, { entries: [{}] }, { entries: [] }],
        })
      );

      expect(figures.unpaidCount).toBe(2);
    });

    it("is zero when every item has been paid", () => {
      const figures = summarizeMonth(input({ items: [{ entries: [{}] }, { entries: [{}] }] }));

      expect(figures.unpaidCount).toBe(0);
    });
  });

  describe("balanceCents", () => {
    it("is all-time contributions less expenses, plus all-time adjustments", () => {
      const figures = summarizeMonth(
        input({
          allTimeContributionCents: 500_000,
          allTimeExpenseCents: 320_000,
          allTimeAdjustmentCents: -5_000,
        })
      );

      expect(figures.balanceCents).toBe(175_000);
    });

    it("does not move with this month's figures", () => {
      // "Op rekening (nu)" is all-time; a past month being viewed must not
      // change it.
      const base = input({
        allTimeContributionCents: 500_000,
        allTimeExpenseCents: 320_000,
        allTimeAdjustmentCents: 0,
      });

      const quietMonth = summarizeMonth(base);
      const busyMonth = summarizeMonth({
        ...base,
        paidInCents: 90_000,
        paidOutCents: 10_000,
        adjustments: [{ amountCents: 7_000 }],
      });

      expect(busyMonth.balanceCents).toBe(quietMonth.balanceCents);
      expect(busyMonth.netto).not.toBe(quietMonth.netto);
    });

    it("goes negative when the household has overspent all-time", () => {
      const figures = summarizeMonth(
        input({ allTimeContributionCents: 10_000, allTimeExpenseCents: 25_000 })
      );

      expect(figures.balanceCents).toBe(-15_000);
    });
  });
});

describe("EMPTY_MONTH_FIGURES", () => {
  it("is every figure at zero, for a household that has set nothing up", () => {
    expect(EMPTY_MONTH_FIGURES).toEqual({
      paidIn: 0,
      paidOut: 0,
      adjustmentSum: 0,
      netto: 0,
      unpaidCount: 0,
      balanceCents: 0,
    });
  });
});
