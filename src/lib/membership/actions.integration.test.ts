/**
 * Founding, joining and leaving a household, against a real database.
 *
 * The join code is the only thing standing between a stranger and somebody's
 * household, and "am I already in one" is enforced by a read the action does
 * itself rather than by a constraint — so both are checked here.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import { createHousehold, joinHousehold, leaveHousehold } from "@/src/lib/membership/actions";
import { aHouseholdWith, aLoneUser } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("createHousehold", () => {
  it("connects the founder to the household they made", async () => {
    const user = await aLoneUser("sam");

    signInAs(user);
    const result = await createHousehold(formData({ name: "  Thuis  " }));

    expect(result.success).toBe(true);
    const household = await db.household.findFirst({ where: { name: "Thuis" } });
    expect(await db.user.findUnique({ where: { id: user.id } })).toMatchObject({
      householdId: household!.id,
    });
  });

  it("gives the household a join code", async () => {
    signInAs(await aLoneUser("sam"));
    await createHousehold(formData({ name: "Thuis" }));

    expect(await db.household.findFirst({ where: { name: "Thuis" } })).toMatchObject({
      secret: expect.stringMatching(/^[A-Z0-9]+$/),
    });
  });

  it("refuses a second household to someone already in one", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    expect(await createHousehold(formData({ name: "Nog een" }))).toMatchObject({ success: false });
    expect(await db.household.count()).toBe(1);
  });

  it("refuses a name another household already took", async () => {
    await aHouseholdWith("robin", "Thuis");

    signInAs(await aLoneUser("sam"));

    expect(await createHousehold(formData({ name: "Thuis" }))).toMatchObject({ success: false });
  });

  it("refuses a name that is only whitespace", async () => {
    signInAs(await aLoneUser("sam"));

    expect(await createHousehold(formData({ name: "   " }))).toMatchObject({ success: false });
    expect(await db.household.count()).toBe(0);
  });
});

describe("joinHousehold", () => {
  it("joins on the household's code, however it was typed", async () => {
    const { household } = await aHouseholdWith("sam");
    const newcomer = await aLoneUser("robin");

    signInAs(newcomer);
    const result = await joinHousehold(
      formData({ secret: `  ${household.secret!.toLowerCase()} ` })
    );

    expect(result.success).toBe(true);
    expect(await db.user.findUnique({ where: { id: newcomer.id } })).toMatchObject({
      householdId: household.id,
    });
  });

  it("refuses a code that belongs to no household", async () => {
    const user = await aLoneUser("sam");
    await aHouseholdWith("robin");

    signInAs(user);

    expect(await joinHousehold(formData({ secret: "NOPE" }))).toMatchObject({ success: false });
    expect(await db.user.findUnique({ where: { id: user.id } })).toMatchObject({
      householdId: null,
    });
  });

  it("refuses to move someone who is already in a household", async () => {
    const ours = await aHouseholdWith("sam");
    const theirs = await aHouseholdWith("robin");

    signInAs(ours.member);

    expect(await joinHousehold(formData({ secret: theirs.household.secret! }))).toMatchObject({
      success: false,
    });
    expect(await db.user.findUnique({ where: { id: ours.member.id } })).toMatchObject({
      householdId: ours.household.id,
    });
  });
});

describe("leaveHousehold", () => {
  it("lets a member leave without touching anyone else", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });

    signInAs(member);
    await leaveHousehold();

    expect(await db.user.findUnique({ where: { id: member.id } })).toMatchObject({
      householdId: null,
    });
    expect(await db.user.findUnique({ where: { id: housemate.id } })).toMatchObject({
      householdId: household.id,
    });
  });
});
