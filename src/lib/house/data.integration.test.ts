/**
 * What the two reads behind the home screen are allowed to return.
 *
 * A leak here is quieter than a leak in an action: nothing fails, another
 * household's shopping just appears on your list. Both functions are `"use
 * server"`, so each is also a POST endpoint any signed-in caller can hit
 * directly — the scope has to come from the session, and these prove it does.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import { getHomeData } from "@/src/lib/house/data";
import { aCategory, aGrocery, aHouseholdWith, aLoneUser } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

describe("getHomeData", () => {
  it("returns the caller's household list and not another household's", async () => {
    const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
    await aGrocery({ householdId: ours.household.id }, { name: "brood" });
    await aGrocery({ householdId: theirs.household.id }, { name: "melk" });
    await aCategory({ householdId: ours.household.id }, "zuivel");
    await aCategory({ householdId: theirs.household.id }, "vlees");

    signInAs(theirs.member);
    const data = await getHomeData(false);

    expect(data.items.map((item) => item.name)).toEqual(["melk"]);
    expect(data.categories.map((category) => category.name)).toEqual(["vlees"]);
  });

  it("keeps a housemate's personal list out of the personal view", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });
    await aGrocery({ userId: member.id }, { name: "deodorant" });
    await aGrocery({ userId: housemate.id }, { name: "scheermesjes" });
    await aGrocery({ householdId: household.id }, { name: "brood" });

    signInAs(member);
    const data = await getHomeData(true);

    expect(data.items.map((item) => item.name)).toEqual(["deodorant"]);
  });

  it("includes bought items, because they render in the collapsed section", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "brood", bought: true });

    signInAs(member);

    expect((await getHomeData(false)).items).toHaveLength(1);
  });

  it("has nothing to scope a shared list to when the caller has no household", async () => {
    const user = await aLoneUser("sam");
    const { household } = await aHouseholdWith("robin");
    await aGrocery({ householdId: household.id }, { name: "melk" });

    signInAs(user);

    expect(await getHomeData(false)).toEqual({ items: [], categories: [] });
  });
});
