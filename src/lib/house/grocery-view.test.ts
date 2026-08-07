import { describe, it, expect } from "vitest";
import {
  appendCategory,
  appendItem,
  isOptimistic,
  moveItemToCategory,
  parseItemName,
  removeCategory,
  removeItems,
  renameItem,
  replaceItem,
  setItemBought,
  snapshotForRestore,
  type GroceryWithCategory,
  type ViewData,
} from "./grocery-view";
import { aCategory, aGrocery, aViewData } from "@/tests/fixtures/house";

describe("parseItemName", () => {
  it("accepts an ordinary name, lowercased so duplicates collapse", () => {
    expect(parseItemName("Melk")).toEqual({ ok: true, name: "melk" });
  });

  it("trims the surrounding whitespace", () => {
    expect(parseItemName("  melk  ")).toEqual({ ok: true, name: "melk" });
  });

  it("refuses a name that is only whitespace", () => {
    expect(parseItemName("   ")).toEqual({ ok: false, message: "Voer een itemnaam in" });
  });

  it("refuses an empty name", () => {
    expect(parseItemName("").ok).toBe(false);
  });

  it("accepts a name of exactly thirty characters", () => {
    expect(parseItemName("a".repeat(30)).ok).toBe(true);
  });

  it("refuses a name longer than thirty characters", () => {
    expect(parseItemName("a".repeat(31))).toEqual({
      ok: false,
      message: "Itemnaam mag maximaal 30 karakters zijn",
    });
  });

  // The length limit is on the trimmed name, so trailing spaces can't trip it.
  it("measures the trimmed name, not what was typed", () => {
    expect(parseItemName(`  ${"a".repeat(30)}  `).ok).toBe(true);
  });
});

describe("setItemBought", () => {
  it("checks off only the item asked for", () => {
    const data = aViewData({
      items: [aGrocery({ id: 1, bought: false }), aGrocery({ id: 2, bought: false })],
    });

    const next = setItemBought(data, 1, true);

    expect(next.items.map((i) => i.bought)).toEqual([true, false]);
  });

  it("leaves the original untouched, so a rollback still has it", () => {
    const data = aViewData({ items: [aGrocery({ id: 1, bought: false })] });

    setItemBought(data, 1, true);

    expect(data.items[0].bought).toBe(false);
  });
});

describe("renameItem", () => {
  it("renames only the item asked for", () => {
    const data = aViewData({
      items: [aGrocery({ id: 1, name: "melk" }), aGrocery({ id: 2, name: "brood" })],
    });

    expect(renameItem(data, 2, "bruin brood").items.map((i) => i.name)).toEqual([
      "melk",
      "bruin brood",
    ]);
  });
});

describe("moveItemToCategory", () => {
  it("files the item under the new category, id and all", () => {
    const zuivel = aCategory({ id: 7, name: "Zuivel" });
    const data = aViewData({ items: [aGrocery({ id: 1, categoryId: null, category: null })] });

    const moved = moveItemToCategory(data, 1, zuivel).items[0];

    expect(moved.categoryId).toBe(7);
    expect(moved.category).toEqual(zuivel);
  });

  it("puts the item back to uncategorized when given no category", () => {
    const zuivel = aCategory({ id: 7 });
    const data = aViewData({ items: [aGrocery({ id: 1, categoryId: 7, category: zuivel })] });

    const moved = moveItemToCategory(data, 1, null).items[0];

    expect(moved.categoryId).toBeNull();
    expect(moved.category).toBeNull();
  });
});

describe("replaceItem", () => {
  it("swaps the optimistic row for the one the server created", () => {
    const data = aViewData({ items: [aGrocery({ id: -1, name: "melk" })] });
    const saved: GroceryWithCategory = aGrocery({ id: 42, name: "melk" });

    expect(replaceItem(data, -1, saved).items).toEqual([saved]);
  });

  it("keeps the item in place rather than moving it to the end", () => {
    const data = aViewData({
      items: [aGrocery({ id: 1 }), aGrocery({ id: -1 }), aGrocery({ id: 2 })],
    });

    const next = replaceItem(data, -1, aGrocery({ id: 42 }));

    expect(next.items.map((i) => i.id)).toEqual([1, 42, 2]);
  });
});

describe("appendItem", () => {
  it("adds the item at the end, where the user just typed it", () => {
    const data = aViewData({ items: [aGrocery({ id: 1 })] });

    expect(appendItem(data, aGrocery({ id: 2 })).items.map((i) => i.id)).toEqual([1, 2]);
  });
});

describe("removeItems", () => {
  it("removes every id it was given and nothing else", () => {
    const data = aViewData({
      items: [aGrocery({ id: 1 }), aGrocery({ id: 2 }), aGrocery({ id: 3 })],
    });

    expect(removeItems(data, [1, 3]).items.map((i) => i.id)).toEqual([2]);
  });

  it("does nothing when nothing matches", () => {
    const data = aViewData({ items: [aGrocery({ id: 1 })] });

    expect(removeItems(data, [99]).items).toHaveLength(1);
  });
});

describe("removeCategory", () => {
  const zuivel = aCategory({ id: 7, name: "Zuivel" });

  const dataWithCategory = (): ViewData =>
    aViewData({
      items: [
        aGrocery({ id: 1, categoryId: 7, category: zuivel }),
        aGrocery({ id: 2, categoryId: null, category: null }),
      ],
      categories: [zuivel, aCategory({ id: 8, name: "Brood" })],
    });

  it("drops the category itself", () => {
    expect(removeCategory(dataWithCategory(), 7).categories.map((c) => c.id)).toEqual([8]);
  });

  // Deleting a category must not delete the shopping it held.
  it("keeps the items and files them as uncategorized", () => {
    const next = removeCategory(dataWithCategory(), 7);

    expect(next.items).toHaveLength(2);
    expect(next.items[0].categoryId).toBeNull();
    expect(next.items[0].category).toBeNull();
  });

  it("leaves items in other categories alone", () => {
    const next = removeCategory(dataWithCategory(), 8);

    expect(next.items[0].categoryId).toBe(7);
  });
});

describe("appendCategory", () => {
  it("adds the new category to the picker", () => {
    const data = aViewData({ categories: [aCategory({ id: 1 })] });

    expect(appendCategory(data, aCategory({ id: 2 })).categories.map((c) => c.id)).toEqual([1, 2]);
  });
});

describe("snapshotForRestore", () => {
  it("remembers a checked item as checked, so undo puts it back checked", () => {
    expect(snapshotForRestore(aGrocery({ bought: true }))).toMatchObject({ bought: true });
  });

  it("remembers an unchecked item as unchecked", () => {
    expect(snapshotForRestore(aGrocery({ bought: false }))).toMatchObject({ bought: false });
  });

  // The column is nullable, and a null means not bought.
  it("treats a null as unchecked rather than leaving it unset", () => {
    expect(snapshotForRestore(aGrocery({ bought: null }))).toMatchObject({ bought: false });
  });

  it("remembers which list the item belonged to", () => {
    expect(snapshotForRestore(aGrocery({ userId: 3, householdId: null }))).toMatchObject({
      personal: true,
    });
    expect(snapshotForRestore(aGrocery({ userId: null, householdId: 1 }))).toMatchObject({
      personal: false,
    });
  });

  it("remembers the category so the item comes back where it was", () => {
    expect(snapshotForRestore(aGrocery({ name: "melk", categoryId: 7 }))).toMatchObject({
      name: "melk",
      categoryId: 7,
    });
  });
});

describe("isOptimistic", () => {
  it("recognises a temp row, which has no server row to act on yet", () => {
    expect(isOptimistic(-1)).toBe(true);
  });

  it("treats a real database id as saved", () => {
    expect(isOptimistic(1)).toBe(false);
  });
});
