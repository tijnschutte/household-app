/**
 * The household the caller belongs to.
 *
 * The row this returns carries `secret`, the code that lets anyone holding it
 * join — so "whose household is this" has to be answered from the session and
 * from nothing else.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import { getCurrentHousehold } from "@/src/lib/membership/data";
import { aHouseholdWith, aLoneUser } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

describe("getCurrentHousehold", () => {
  it("returns the caller's own household with its members", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await db.user.create({ data: { name: "robin", householdId: household.id, password: "x" } });
    await aHouseholdWith("casey");

    signInAs(member);
    const result = await getCurrentHousehold();

    expect(result).toMatchObject({ id: household.id });
    expect(result!.members.map((member) => member.name).sort()).toEqual(["robin", "sam"]);
  });

  it("names only the members of that household", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const other = await aHouseholdWith("robin");
    await db.user.create({
      data: { name: "casey", householdId: other.household.id, password: "x" },
    });

    signInAs(member);

    expect((await getCurrentHousehold())!.members.map((member) => member.name)).toEqual(["sam"]);
    expect(household.id).not.toBe(other.household.id);
  });

  it("returns nothing for someone who has not joined one", async () => {
    await aHouseholdWith("robin");
    signInAs(await aLoneUser("sam"));

    expect(await getCurrentHousehold()).toBeNull();
  });
});
