/**
 * The scoping and domain rules on the household pot, against a real database.
 *
 * Every mutation starts from `requireHousehold()` and re-checks that the item
 * it was handed belongs to that household — the id in the argument is a number
 * off the wire and proves nothing. These tests hand each action a number that
 * belongs to somebody else.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import {
  addAdjustment,
  createRecurringItem,
  deleteAdjustment,
  deleteRecurringItem,
  endRecurringItem,
  markPaid,
  undoPaid,
  updateRecurringItem,
} from "@/src/lib/geld/actions";
import { RecurringKind } from "@prisma/client";
import { aHouseholdWith, aLoneUser, aRecurringItem } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

const MONTH = "2026-07";

async function twoHouseholds() {
  const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
  return { ours, theirs };
}

describe("markPaid", () => {
  it("records the amount, which is what paying is", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Sam inleg" });

    signInAs(member);
    const result = await markPaid(item.id, MONTH, 8700);

    expect(result.success).toBe(true);
    expect(await db.monthEntry.findFirst({ where: { recurringItemId: item.id } })).toMatchObject({
      month: MONTH,
      amountCents: 8700,
    });
  });

  it("refuses an item belonging to another household", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Sam inleg" });

    signInAs(theirs.member);
    const result = await markPaid(item.id, MONTH, 8700);

    expect(result).toMatchObject({ success: false });
    expect(await db.monthEntry.count()).toBe(0);
  });

  it("refuses a month the item was not active in", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, {
      name: "Oude huur",
      activeFrom: "2026-01",
      activeTo: "2026-03",
    });

    signInAs(member);

    expect(await markPaid(item.id, MONTH, 8700)).toMatchObject({ success: false });
    expect(await db.monthEntry.count()).toBe(0);
  });

  it("reports a month that was already paid rather than paying it twice", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Sam inleg" });

    signInAs(member);
    await markPaid(item.id, MONTH, 8700);
    const second = await markPaid(item.id, MONTH, 9900);

    expect(second).toMatchObject({ success: false });
    expect(await db.monthEntry.count()).toBe(1);
  });

  it("refuses a negative amount", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Sam inleg" });

    signInAs(member);

    expect(await markPaid(item.id, MONTH, -8700)).toMatchObject({ success: false });
    expect(await db.monthEntry.count()).toBe(0);
  });

  it("tells someone with no household that there is no pot to pay into", async () => {
    const { ours } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Sam inleg" });

    signInAs(await aLoneUser("casey"));

    expect(await markPaid(item.id, MONTH, 8700)).toMatchObject({ success: false });
  });
});

describe("undoPaid", () => {
  it("removes the caller's own entry", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Sam inleg" });
    await db.monthEntry.create({
      data: { recurringItemId: item.id, month: MONTH, amountCents: 8700 },
    });

    signInAs(member);
    await undoPaid(item.id, MONTH);

    expect(await db.monthEntry.count()).toBe(0);
  });

  it("leaves another household's entry alone", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Sam inleg" });
    await db.monthEntry.create({
      data: { recurringItemId: item.id, month: MONTH, amountCents: 8700 },
    });

    signInAs(theirs.member);
    const result = await undoPaid(item.id, MONTH);

    expect(result).toMatchObject({ success: false });
    expect(await db.monthEntry.count()).toBe(1);
  });
});

describe("createRecurringItem", () => {
  it("files the item under the caller's household", async () => {
    const { household, member } = await aHouseholdWith("sam");

    signInAs(member);
    const result = await createRecurringItem("Huur", RecurringKind.EXPENSE, 120_000, "2026-01");

    expect(result.success).toBe(true);
    expect(await db.recurringItem.findFirst({ where: { name: "Huur" } })).toMatchObject({
      householdId: household.id,
      kind: RecurringKind.EXPENSE,
    });
  });

  it("reports a name already used for that kind in this household", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aRecurringItem(household.id, { name: "Huur", kind: RecurringKind.EXPENSE });

    signInAs(member);

    expect(
      await createRecurringItem("Huur", RecurringKind.EXPENSE, 120_000, "2026-01")
    ).toMatchObject({ success: false });
  });

  it("refuses a month that is not YYYY-MM", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    expect(
      await createRecurringItem("Huur", RecurringKind.EXPENSE, 120_000, "januari 2026")
    ).toMatchObject({ success: false });
    expect(await db.recurringItem.count()).toBe(0);
  });
});

describe("updateRecurringItem", () => {
  it("refuses to edit another household's item", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Huur", expectedCents: 120_000 });

    signInAs(theirs.member);
    const result = await updateRecurringItem(item.id, { name: "Gekaapt", expectedCents: 1 });

    expect(result).toMatchObject({ success: false });
    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).toMatchObject({
      name: "Huur",
      expectedCents: 120_000,
    });
  });

  it("updates only the fields it was given", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Huur", expectedCents: 120_000 });

    signInAs(member);
    await updateRecurringItem(item.id, { expectedCents: 130_000 });

    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).toMatchObject({
      name: "Huur",
      expectedCents: 130_000,
    });
  });
});

describe("endRecurringItem", () => {
  it("refuses to end another household's item", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Huur" });

    signInAs(theirs.member);

    expect(await endRecurringItem(item.id, MONTH)).toMatchObject({ success: false });
    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).toMatchObject({
      activeTo: null,
    });
  });

  it("refuses a last month that falls before the item started", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Huur", activeFrom: "2026-05" });

    signInAs(member);

    expect(await endRecurringItem(item.id, "2026-02")).toMatchObject({ success: false });
    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).toMatchObject({
      activeTo: null,
    });
  });
});

describe("deleteRecurringItem", () => {
  it("refuses to delete another household's item", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aRecurringItem(ours.household.id, { name: "Huur" });

    signInAs(theirs.member);

    expect(await deleteRecurringItem(item.id)).toMatchObject({ success: false });
    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).not.toBeNull();
  });

  it("refuses to delete an item that has already been paid, so history survives", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Huur" });
    await db.monthEntry.create({
      data: { recurringItemId: item.id, month: MONTH, amountCents: 8700 },
    });

    signInAs(member);

    expect(await deleteRecurringItem(item.id)).toMatchObject({ success: false });
    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).not.toBeNull();
  });

  it("deletes an item nobody ever paid", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aRecurringItem(household.id, { name: "Vergissing" });

    signInAs(member);
    await deleteRecurringItem(item.id);

    expect(await db.recurringItem.findUnique({ where: { id: item.id } })).toBeNull();
  });
});

describe("adjustments", () => {
  it("books a correction against the caller's own household", async () => {
    const { household, member } = await aHouseholdWith("sam");

    signInAs(member);
    await addAdjustment(MONTH, -2500, "  te veel gepind  ");

    expect(await db.adjustment.findFirst()).toMatchObject({
      householdId: household.id,
      amountCents: -2500,
      note: "te veel gepind",
    });
  });

  it("refuses a correction of nothing", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    expect(await addAdjustment(MONTH, 0)).toMatchObject({ success: false });
    expect(await db.adjustment.count()).toBe(0);
  });

  it("refuses to delete another household's correction", async () => {
    const { ours, theirs } = await twoHouseholds();
    const adjustment = await db.adjustment.create({
      data: { householdId: ours.household.id, month: MONTH, amountCents: -2500 },
    });

    signInAs(theirs.member);

    expect(await deleteAdjustment(adjustment.id)).toMatchObject({ success: false });
    expect(await db.adjustment.findUnique({ where: { id: adjustment.id } })).not.toBeNull();
  });
});
