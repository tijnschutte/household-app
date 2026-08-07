import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { RecurringKind } from "@prisma/client";
import { summarizeMonth, EMPTY_MONTH_FIGURES } from "@/src/lib/geld/summary";

export type GeldItem = {
  id: number;
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
  activeTo: string | null;
  entry: { id: number; amountCents: number; paidAt: Date } | null;
};

export type GeldAdjustment = {
  id: number;
  amountCents: number;
  note: string | null;
  createdAt: Date;
};

export type GeldMonth = {
  month: string;
  contributions: GeldItem[];
  expenses: GeldItem[];
  paidIn: number;
  paidOut: number;
  adjustments: GeldAdjustment[];
  adjustmentSum: number;
  netto: number;
  unpaidCount: number;
  /** All-time balance across every month ("op rekening"), not just this month. */
  balanceCents: number;
};

// Items "active" in month m: activeFrom <= m && (activeTo == null || activeTo >= m).
function activeInMonthWhere(month: string) {
  return {
    activeFrom: { lte: month },
    OR: [{ activeTo: null }, { activeTo: { gte: month } }],
  };
}

/**
 * Full checklist + figures for one month, scoped to the caller's household.
 * `entry` on each item is that item's MonthEntry for `month`, if it's been
 * paid — entering an amount IS paying it, there's no separate paid flag.
 */
export async function getGeldMonth(month: string): Promise<GeldMonth> {
  const { householdId } = await requireUser();

  if (!householdId) {
    return {
      month,
      contributions: [],
      expenses: [],
      adjustments: [],
      ...EMPTY_MONTH_FIGURES,
    };
  }

  const [items, adjustments, contributionSum, expenseSum, adjustmentAllTimeSum] = await Promise.all(
    [
      prisma.recurringItem.findMany({
        where: { householdId, ...activeInMonthWhere(month) },
        include: { entries: { where: { month } } },
        orderBy: { name: "asc" },
      }),
      prisma.adjustment.findMany({
        where: { householdId, month },
        orderBy: { createdAt: "asc" },
      }),
      prisma.monthEntry.aggregate({
        _sum: { amountCents: true },
        where: { month, recurringItem: { householdId, kind: RecurringKind.CONTRIBUTION } },
      }),
      prisma.monthEntry.aggregate({
        _sum: { amountCents: true },
        where: { month, recurringItem: { householdId, kind: RecurringKind.EXPENSE } },
      }),
      prisma.adjustment.aggregate({
        _sum: { amountCents: true },
        where: { householdId },
      }),
    ]
  );

  const toGeldItem = (item: (typeof items)[number]): GeldItem => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    expectedCents: item.expectedCents,
    activeFrom: item.activeFrom,
    activeTo: item.activeTo,
    entry: item.entries[0]
      ? {
          id: item.entries[0].id,
          amountCents: item.entries[0].amountCents,
          paidAt: item.entries[0].paidAt,
        }
      : null,
  });

  const contributions = items
    .filter((item) => item.kind === RecurringKind.CONTRIBUTION)
    .map(toGeldItem);
  const expenses = items.filter((item) => item.kind === RecurringKind.EXPENSE).map(toGeldItem);

  // All-time balance: sum of every month's (contributions - expenses +
  // adjustments) for the household, not just this month.
  const [allTimeContribution, allTimeExpense] = await Promise.all([
    prisma.monthEntry.aggregate({
      _sum: { amountCents: true },
      where: { recurringItem: { householdId, kind: RecurringKind.CONTRIBUTION } },
    }),
    prisma.monthEntry.aggregate({
      _sum: { amountCents: true },
      where: { recurringItem: { householdId, kind: RecurringKind.EXPENSE } },
    }),
  ]);

  const figures = summarizeMonth({
    paidInCents: contributionSum._sum.amountCents,
    paidOutCents: expenseSum._sum.amountCents,
    adjustments,
    items,
    allTimeContributionCents: allTimeContribution._sum.amountCents,
    allTimeExpenseCents: allTimeExpense._sum.amountCents,
    allTimeAdjustmentCents: adjustmentAllTimeSum._sum.amountCents,
  });

  return { month, contributions, expenses, adjustments, ...figures };
}

export type RecurringItemRow = {
  id: number;
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
  activeTo: string | null;
  hasEntries: boolean;
};

/** All recurring items (including ended ones) for the beheer view. */
export async function getRecurringItems(): Promise<RecurringItemRow[]> {
  const { householdId } = await requireUser();
  if (!householdId) return [];

  const items = await prisma.recurringItem.findMany({
    where: { householdId },
    include: { _count: { select: { entries: true } } },
    orderBy: [{ activeTo: "asc" }, { kind: "asc" }, { name: "asc" }],
  });

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    expectedCents: item.expectedCents,
    activeFrom: item.activeFrom,
    activeTo: item.activeTo,
    hasEntries: item._count.entries > 0,
  }));
}
