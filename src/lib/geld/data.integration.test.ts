/**
 * What the Geld page reads, and whose money ends up in it.
 *
 * `summary.ts` already proves the arithmetic over rows it is handed. What it
 * cannot prove is which rows those are: the aggregates here run in Postgres,
 * so a missing `householdId` in one of five `where` clauses would add another
 * household's balance to yours with every unit test still green.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import { getGeldMonth, getRecurringItems } from "@/src/lib/geld/data";
import { RecurringKind } from "@prisma/client";
import { aHouseholdWith, aLoneUser, aRecurringItem } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

const MONTH = "2026-07";

describe("getGeldMonth", () => {
  it("splits the month's items into contributions and expenses", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const inleg = await aRecurringItem(household.id, {
      name: "Sam inleg",
      kind: RecurringKind.CONTRIBUTION,
      expectedCents: 20_000,
    });
    await aRecurringItem(household.id, {
      name: "Huur",
      kind: RecurringKind.EXPENSE,
      expectedCents: 120_000,
    });
    await db.monthEntry.create({
      data: { recurringItemId: inleg.id, month: MONTH, amountCents: 20_000 },
    });

    signInAs(member);
    const result = await getGeldMonth(MONTH);

    expect(result.contributions.map((item) => item.name)).toEqual(["Sam inleg"]);
    expect(result.expenses.map((item) => item.name)).toEqual(["Huur"]);
    expect(result.paidIn).toBe(20_000);
    expect(result.unpaidCount).toBe(1);
    expect(result.contributions[0].entry).toMatchObject({ amountCents: 20_000 });
  });

  it("leaves out items that were not active in the month", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aRecurringItem(household.id, { name: "Nog niet", activeFrom: "2026-09" });
    await aRecurringItem(household.id, {
      name: "Al voorbij",
      activeFrom: "2026-01",
      activeTo: "2026-03",
    });
    await aRecurringItem(household.id, { name: "Nu", activeFrom: "2026-01" });

    signInAs(member);

    expect((await getGeldMonth(MONTH)).contributions.map((item) => item.name)).toEqual(["Nu"]);
  });

  it("counts no other household's money towards the balance", async () => {
    const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
    const ourItem = await aRecurringItem(ours.household.id, { name: "Sam inleg" });
    const theirItem = await aRecurringItem(theirs.household.id, { name: "Robin inleg" });
    await db.monthEntry.createMany({
      data: [
        { recurringItemId: ourItem.id, month: MONTH, amountCents: 50_000 },
        { recurringItemId: theirItem.id, month: MONTH, amountCents: 700 },
      ],
    });
    await db.adjustment.createMany({
      data: [
        { householdId: ours.household.id, month: MONTH, amountCents: 90_000 },
        { householdId: theirs.household.id, month: MONTH, amountCents: 300 },
      ],
    });

    signInAs(theirs.member);
    const result = await getGeldMonth(MONTH);

    expect(result.paidIn).toBe(700);
    expect(result.adjustmentSum).toBe(300);
    expect(result.balanceCents).toBe(1000);
    expect(result.adjustments).toHaveLength(1);
  });

  it("counts every month towards the balance, not just the one on screen", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Sam inleg" });
    await db.monthEntry.createMany({
      data: [
        { recurringItemId: item.id, month: "2026-06", amountCents: 20_000 },
        { recurringItemId: item.id, month: MONTH, amountCents: 20_000 },
      ],
    });

    signInAs(member);
    const result = await getGeldMonth(MONTH);

    expect(result.paidIn).toBe(20_000);
    expect(result.balanceCents).toBe(40_000);
  });

  it("has an empty month to show someone with no household", async () => {
    const { household } = await aHouseholdWith("robin");
    const item = await aRecurringItem(household.id, { name: "Robin inleg" });
    await db.monthEntry.create({
      data: { recurringItemId: item.id, month: MONTH, amountCents: 20_000 },
    });

    signInAs(await aLoneUser("sam"));
    const result = await getGeldMonth(MONTH);

    expect(result.contributions).toEqual([]);
    expect(result.balanceCents).toBe(0);
  });
});

describe("getRecurringItems", () => {
  it("lists the caller's household's items, ended ones included", async () => {
    const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
    await aRecurringItem(ours.household.id, { name: "Van hen" });
    await aRecurringItem(theirs.household.id, { name: "Actief" });
    await aRecurringItem(theirs.household.id, { name: "Beëindigd", activeTo: "2026-03" });

    signInAs(theirs.member);

    expect((await getRecurringItems()).map((item) => item.name).sort()).toEqual([
      "Actief",
      "Beëindigd",
    ]);
  });

  it("marks an item that has been paid, because that decides it cannot be deleted", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const paid = await aRecurringItem(household.id, { name: "Huur" });
    await aRecurringItem(household.id, { name: "Ongebruikt" });
    await db.monthEntry.create({
      data: { recurringItemId: paid.id, month: MONTH, amountCents: 8700 },
    });

    signInAs(member);
    const items = await getRecurringItems();

    expect(items.find((item) => item.name === "Huur")).toMatchObject({ hasEntries: true });
    expect(items.find((item) => item.name === "Ongebruikt")).toMatchObject({ hasEntries: false });
  });
});
