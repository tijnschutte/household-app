/**
 * The scoping rules on the boodschappenlijst, against a real database.
 *
 * Every action here derives `userId`/`householdId` from the session and builds
 * a `where` clause from them. Nothing in `bun run verify` can tell whether that
 * clause is present: drop it and the types still check, the components still
 * render, and one household starts editing another's list. So each test below
 * has a second household look at rows that are not theirs.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import {
  createCategory,
  createGroceryItem,
  deleteCategory,
  deleteItems,
  restoreItems,
  setGroceryBought,
  updateGroceryCategory,
  updateGroceryName,
} from "@/src/lib/house/actions";
import { aCategory, aGrocery, aHouseholdWith, aLoneUser } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

/** Two households that share nothing, which is what most of these tests need. */
async function twoHouseholds() {
  const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
  return { ours, theirs };
}

describe("setGroceryBought", () => {
  it("ticks an item off the caller's own household list", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aGrocery({ householdId: household.id }, { name: "brood" });

    signInAs(member);
    await setGroceryBought(item.id, true);

    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({ bought: true });
  });

  it("refuses to tick an item belonging to another household", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aGrocery({ householdId: ours.household.id }, { name: "brood" });

    signInAs(theirs.member);

    await expect(setGroceryBought(item.id, true)).rejects.toThrow();
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      bought: false,
    });
  });

  it("refuses to tick another person's personal item", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });
    const item = await aGrocery({ userId: member.id }, { name: "deodorant" });

    signInAs(housemate);

    await expect(setGroceryBought(item.id, true)).rejects.toThrow();
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      bought: false,
    });
  });
});

describe("deleteItems", () => {
  it("refuses to delete another household's items", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aGrocery({ householdId: ours.household.id }, { name: "brood" });

    signInAs(theirs.member);

    await expect(deleteItems([item.id])).rejects.toThrow();
    expect(await db.grocery.findUnique({ where: { id: item.id } })).not.toBeNull();
  });

  it("deletes only the caller's own items out of a mixed batch", async () => {
    const { ours, theirs } = await twoHouseholds();
    const mine = await aGrocery({ householdId: theirs.household.id }, { name: "melk" });
    const notMine = await aGrocery({ householdId: ours.household.id }, { name: "brood" });

    signInAs(theirs.member);
    await deleteItems([mine.id, notMine.id]);

    expect(await db.grocery.findUnique({ where: { id: mine.id } })).toBeNull();
    expect(await db.grocery.findUnique({ where: { id: notMine.id } })).not.toBeNull();
  });
});

describe("updateGroceryName", () => {
  it("stores the name lowercased so duplicates collapse", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const item = await aGrocery({ householdId: household.id }, { name: "brood" });

    signInAs(member);
    const result = await updateGroceryName(item.id, "  Volkoren Brood  ");

    expect(result.success).toBe(true);
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      name: "volkoren brood",
    });
  });

  it("refuses to rename another household's item", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aGrocery({ householdId: ours.household.id }, { name: "brood" });

    signInAs(theirs.member);
    const result = await updateGroceryName(item.id, "gestolen");

    expect(result).toMatchObject({ success: false });
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      name: "brood",
    });
  });

  it("reports a name already on the list as something the user can read", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "melk" });
    const item = await aGrocery({ householdId: household.id }, { name: "brood" });

    signInAs(member);
    const result = await updateGroceryName(item.id, "melk");

    expect(result).toMatchObject({ success: false, message: expect.stringContaining("melk") });
  });
});

describe("updateGroceryCategory", () => {
  it("files an item under a category from the same list", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const category = await aCategory({ householdId: household.id }, "zuivel");
    const item = await aGrocery({ householdId: household.id }, { name: "melk" });

    signInAs(member);
    await updateGroceryCategory(item.id, category.id);

    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      categoryId: category.id,
    });
  });

  it("refuses to file an item into another household's category", async () => {
    const { ours, theirs } = await twoHouseholds();
    const theirCategory = await aCategory({ householdId: ours.household.id }, "zuivel");
    const item = await aGrocery({ householdId: theirs.household.id }, { name: "melk" });

    signInAs(theirs.member);

    await expect(updateGroceryCategory(item.id, theirCategory.id)).rejects.toThrow();
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      categoryId: null,
    });
  });

  it("refuses to move another household's item at all", async () => {
    const { ours, theirs } = await twoHouseholds();
    const item = await aGrocery({ householdId: ours.household.id }, { name: "melk" });

    signInAs(theirs.member);

    await expect(updateGroceryCategory(item.id, null)).rejects.toThrow();
  });
});

describe("createGroceryItem", () => {
  it("puts a shared item on the caller's household list and nobody's personal one", async () => {
    const { household, member } = await aHouseholdWith("sam");

    signInAs(member);
    const result = await createGroceryItem("Brood", false);

    expect(result.success).toBe(true);
    expect(await db.grocery.findFirst({ where: { name: "brood" } })).toMatchObject({
      householdId: household.id,
      userId: null,
    });
  });

  it("puts a personal item on the caller's own list and nobody's shared one", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await createGroceryItem("Deodorant", true);

    expect(await db.grocery.findFirst({ where: { name: "deodorant" } })).toMatchObject({
      householdId: null,
      userId: member.id,
    });
  });

  it("refuses a category belonging to another household", async () => {
    const { ours, theirs } = await twoHouseholds();
    const theirCategory = await aCategory({ householdId: ours.household.id }, "zuivel");

    signInAs(theirs.member);
    const result = await createGroceryItem("melk", false, theirCategory.id);

    expect(result).toMatchObject({ success: false });
    expect(await db.grocery.findFirst({ where: { name: "melk" } })).toBeNull();
  });

  it("refuses to file a personal item under a shared category", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const shared = await aCategory({ householdId: household.id }, "zuivel");

    signInAs(member);
    const result = await createGroceryItem("melk", true, shared.id);

    expect(result).toMatchObject({ success: false });
    expect(await db.grocery.findFirst({ where: { name: "melk" } })).toBeNull();
  });

  it("tells someone with no household that they have nowhere to share to", async () => {
    signInAs(await aLoneUser("sam"));

    expect(await createGroceryItem("brood", false)).toMatchObject({ success: false });
  });
});

describe("restoreItems", () => {
  it("puts an undone delete back on the caller's own list", async () => {
    const { household, member } = await aHouseholdWith("sam");

    signInAs(member);
    const restored = await restoreItems([{ name: "brood", categoryId: null, personal: false }]);

    expect(restored).toBe(1);
    expect(await db.grocery.findFirst({ where: { name: "brood" } })).toMatchObject({
      householdId: household.id,
      userId: null,
      // The clear-afgevinkt flow deletes bought items, so undo restores them bought.
      bought: true,
    });
  });

  it("drops a category the caller does not own rather than linking into it", async () => {
    const { ours, theirs } = await twoHouseholds();
    const theirCategory = await aCategory({ householdId: ours.household.id }, "zuivel");

    signInAs(theirs.member);
    await restoreItems([{ name: "melk", categoryId: theirCategory.id, personal: false }]);

    expect(await db.grocery.findFirst({ where: { name: "melk" } })).toMatchObject({
      householdId: theirs.household.id,
      categoryId: null,
    });
  });

  it("skips a name that came back while the undo was on screen", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "brood" });

    signInAs(member);
    const restored = await restoreItems([
      { name: "brood", categoryId: null, personal: false },
      { name: "melk", categoryId: null, personal: false },
    ]);

    expect(restored).toBe(1);
    expect(await db.grocery.count({ where: { householdId: household.id } })).toBe(2);
  });
});

describe("deleteCategory", () => {
  it("keeps the items and drops only the category", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const category = await aCategory({ householdId: household.id }, "zuivel");
    const item = await aGrocery(
      { householdId: household.id },
      { name: "melk", categoryId: category.id }
    );

    signInAs(member);
    await deleteCategory(category.id);

    expect(await db.category.findUnique({ where: { id: category.id } })).toBeNull();
    expect(await db.grocery.findUnique({ where: { id: item.id } })).toMatchObject({
      categoryId: null,
    });
  });

  it("refuses to delete another household's category", async () => {
    const { ours, theirs } = await twoHouseholds();
    const category = await aCategory({ householdId: ours.household.id }, "zuivel");

    signInAs(theirs.member);

    await expect(deleteCategory(category.id)).rejects.toThrow();
    expect(await db.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  });
});

describe("createCategory", () => {
  it("creates a shared category owned by the caller's household", async () => {
    const { household, member } = await aHouseholdWith("sam");

    signInAs(member);
    await createCategory("Zuivel", false);

    expect(await db.category.findFirst({ where: { name: "Zuivel" } })).toMatchObject({
      householdId: household.id,
      userId: null,
    });
  });

  it("reports a name already used in this household", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aCategory({ householdId: household.id }, "Zuivel");

    signInAs(member);

    expect(await createCategory("Zuivel", false)).toMatchObject({ success: false });
  });
});
