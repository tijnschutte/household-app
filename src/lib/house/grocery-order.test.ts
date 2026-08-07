import { describe, it, expect } from "vitest";
import { sortGroup, groupByCategory } from "./grocery-order";

type TestItem = {
  name: string;
  bought: boolean | null;
  updatedAt: Date;
  categoryId: number | null;
};

function item(overrides: Partial<TestItem> & { name: string }): TestItem {
  return {
    bought: false,
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    categoryId: null,
    ...overrides,
  };
}

const names = (items: readonly TestItem[]) => items.map((i) => i.name);

describe("sortGroup", () => {
  it("keeps unchecked items in the order they arrived", () => {
    const group = sortGroup([
      item({ name: "Melk" }),
      item({ name: "Brood" }),
      item({ name: "Kaas" }),
    ]);

    expect(names(group.items)).toEqual(["Melk", "Brood", "Kaas"]);
  });

  it("sinks checked items below the unchecked ones", () => {
    const group = sortGroup([
      item({ name: "Melk", bought: true }),
      item({ name: "Brood" }),
      item({ name: "Kaas", bought: true }),
    ]);

    expect(names(group.items)).toEqual(["Brood", "Melk", "Kaas"]);
  });

  it("orders checked items most-recently-checked first", () => {
    const group = sortGroup([
      item({ name: "Oud", bought: true, updatedAt: new Date("2026-07-01T09:00:00Z") }),
      item({ name: "Nieuw", bought: true, updatedAt: new Date("2026-07-01T17:00:00Z") }),
      item({ name: "Midden", bought: true, updatedAt: new Date("2026-07-01T13:00:00Z") }),
    ]);

    expect(names(group.items)).toEqual(["Nieuw", "Midden", "Oud"]);
  });

  it("treats a null bought as not bought", () => {
    // The column is nullable, and older rows predate the default.
    const group = sortGroup([item({ name: "Melk", bought: null }), item({ name: "Brood" })]);

    expect(names(group.items)).toEqual(["Melk", "Brood"]);
    expect(group.uncheckedCount).toBe(2);
  });

  it("counts what is left to buy, not what is rendered", () => {
    const group = sortGroup([
      item({ name: "Melk", bought: true }),
      item({ name: "Brood" }),
      item({ name: "Kaas", bought: true }),
    ]);

    expect(group.items).toHaveLength(3);
    expect(group.uncheckedCount).toBe(1);
  });

  it("keeps a fully checked group rather than emptying it", () => {
    const group = sortGroup([
      item({ name: "Melk", bought: true }),
      item({ name: "Brood", bought: true }),
    ]);

    expect(group.items).toHaveLength(2);
    expect(group.uncheckedCount).toBe(0);
  });

  it("does not mutate the array it was given", () => {
    const items = [
      item({ name: "Oud", bought: true, updatedAt: new Date("2026-07-01T09:00:00Z") }),
      item({ name: "Nieuw", bought: true, updatedAt: new Date("2026-07-01T17:00:00Z") }),
    ];

    sortGroup(items);

    expect(names(items)).toEqual(["Oud", "Nieuw"]);
  });

  it("handles an empty group", () => {
    expect(sortGroup([])).toEqual({ items: [], uncheckedCount: 0 });
  });
});

describe("groupByCategory", () => {
  const zuivel = { id: 1, name: "Zuivel" };
  const brood = { id: 2, name: "Brood" };

  it("puts items with no category in the uncategorized group", () => {
    const { uncategorized } = groupByCategory(
      [item({ name: "Melk", categoryId: 1 }), item({ name: "Losse peer" })],
      [zuivel]
    );

    expect(names(uncategorized.items)).toEqual(["Losse peer"]);
  });

  it("files each item under its own category", () => {
    const { categorized } = groupByCategory(
      [
        item({ name: "Melk", categoryId: 1 }),
        item({ name: "Bolletjes", categoryId: 2 }),
        item({ name: "Yoghurt", categoryId: 1 }),
      ],
      [zuivel, brood]
    );

    expect(categorized.map((g) => g.category.name)).toEqual(["Zuivel", "Brood"]);
    expect(names(categorized[0].items)).toEqual(["Melk", "Yoghurt"]);
    expect(names(categorized[1].items)).toEqual(["Bolletjes"]);
  });

  it("returns a category that holds nothing, because it is still a drop target", () => {
    const { categorized } = groupByCategory([item({ name: "Losse peer" })], [zuivel, brood]);

    expect(categorized).toHaveLength(2);
    expect(categorized[0].items).toEqual([]);
    expect(categorized[0].uncheckedCount).toBe(0);
  });

  it("applies the checked-sinks-below rule inside each category", () => {
    const { categorized } = groupByCategory(
      [
        item({ name: "Melk", categoryId: 1, bought: true }),
        item({ name: "Yoghurt", categoryId: 1 }),
      ],
      [zuivel]
    );

    expect(names(categorized[0].items)).toEqual(["Yoghurt", "Melk"]);
    expect(categorized[0].uncheckedCount).toBe(1);
  });

  it("keeps the categories in the order given", () => {
    const { categorized } = groupByCategory([], [brood, zuivel]);

    expect(categorized.map((g) => g.category.name)).toEqual(["Brood", "Zuivel"]);
  });
});
