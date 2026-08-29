import { describe, expect, it } from "vitest";
import { mergeIntoList, type ListRow } from "@/src/lib/recepten/basket";

function aRow(overrides: Partial<ListRow> = {}): ListRow {
  return {
    id: 1,
    name: "ui",
    quantity: null,
    unit: null,
    bought: false,
    ...overrides,
  };
}

describe("mergeIntoList", () => {
  it("creates a line that is not on the list", () => {
    const { create, update } = mergeIntoList([{ name: "ui", quantity: 2, unit: null }], []);

    expect(create).toEqual([{ name: "ui", quantity: 2, unit: null }]);
    expect(update).toEqual([]);
  });

  it("sums the quantity when the line is already on the list, unbought, same unit", () => {
    const existing = aRow({ id: 7, quantity: 2, unit: "stuks" });

    const { create, update } = mergeIntoList(
      [{ name: "ui", quantity: 3, unit: "stuks" }],
      [existing]
    );

    expect(create).toEqual([]);
    expect(update).toEqual([{ id: 7, quantity: 5, unit: "stuks", bought: false }]);
  });

  it("treats null and null as the same unit and sums the quantities", () => {
    const existing = aRow({ id: 7, quantity: 2, unit: null });

    const { update } = mergeIntoList([{ name: "ui", quantity: 3, unit: null }], [existing]);

    expect(update).toEqual([{ id: 7, quantity: 5, unit: null, bought: false }]);
  });

  it("null plus a quantity is the quantity", () => {
    const existing = aRow({ id: 7, quantity: null, unit: null });

    const { update } = mergeIntoList([{ name: "ui", quantity: 3, unit: null }], [existing]);

    expect(update).toEqual([{ id: 7, quantity: 3, unit: null, bought: false }]);
  });

  it("a quantity plus null stays the existing quantity", () => {
    const existing = aRow({ id: 7, quantity: 3, unit: null });

    const { update } = mergeIntoList([{ name: "ui", quantity: null, unit: null }], [existing]);

    expect(update).toEqual([{ id: 7, quantity: 3, unit: null, bought: false }]);
  });

  it("un-boughts a bought row and replaces its quantity/unit rather than summing", () => {
    const existing = aRow({ id: 7, quantity: 2, unit: "stuks", bought: true });

    const { update } = mergeIntoList([{ name: "ui", quantity: 3, unit: "gram" }], [existing]);

    expect(update).toEqual([{ id: 7, quantity: 3, unit: "gram", bought: false }]);
  });

  it("leaves an unbought row untouched when the unit differs, without creating or erroring", () => {
    const existing = aRow({ id: 7, quantity: 2, unit: "stuks" });

    const { create, update } = mergeIntoList(
      [{ name: "ui", quantity: 1, unit: "gram" }],
      [existing]
    );

    expect(create).toEqual([]);
    expect(update).toEqual([]);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const existing = aRow({ id: 7, name: "Ui", quantity: 2, unit: null });

    const { create, update } = mergeIntoList(
      [{ name: " ui ", quantity: 1, unit: null }],
      [existing]
    );

    expect(create).toEqual([]);
    expect(update).toEqual([{ id: 7, quantity: 3, unit: null, bought: false }]);
  });

  it("handles several lines against the same list independently", () => {
    const onion = aRow({ id: 1, name: "ui", quantity: 2, unit: null });
    const milk = aRow({ id: 2, name: "melk", quantity: 1, unit: "liter", bought: true });

    const { create, update } = mergeIntoList(
      [
        { name: "ui", quantity: 1, unit: null },
        { name: "melk", quantity: 1, unit: "liter" },
        { name: "kaas", quantity: null, unit: null },
      ],
      [onion, milk]
    );

    expect(create).toEqual([{ name: "kaas", quantity: null, unit: null }]);
    expect(update).toEqual(
      expect.arrayContaining([
        { id: 1, quantity: 3, unit: null, bought: false },
        { id: 2, quantity: 1, unit: "liter", bought: false },
      ])
    );
  });
});
