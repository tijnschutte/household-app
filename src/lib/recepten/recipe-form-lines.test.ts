import { describe, expect, it } from "vitest";
import { parseIngredientLines, toFormLines } from "@/src/lib/recepten/recipe-form-lines";

describe("toFormLines", () => {
  it("gives a recipe without lines one blank row to type into", () => {
    expect(toFormLines([])).toEqual([{ name: "", quantity: "", unit: "" }]);
  });

  it("writes the quantity with a decimal comma and blanks a missing unit", () => {
    expect(
      toFormLines([
        { name: "ui", quantity: 1.5, unit: null },
        { name: "kaas", quantity: null, unit: "gram" },
      ])
    ).toEqual([
      { name: "ui", quantity: "1,5", unit: "" },
      { name: "kaas", quantity: "", unit: "gram" },
    ]);
  });
});

describe("parseIngredientLines", () => {
  it("drops rows with no name and keeps the others in order", () => {
    const { ingredients, errors } = parseIngredientLines([
      { name: "ui", quantity: "2", unit: "stuks" },
      { name: "  ", quantity: "5", unit: "" },
      { name: "kaas", quantity: "", unit: "  " },
    ]);

    expect(errors).toEqual([]);
    expect(ingredients).toEqual([
      { name: "ui", quantity: 2, unit: "stuks" },
      { name: "kaas", quantity: null, unit: null },
    ]);
  });

  it("reports an unparseable quantity against its own row (B1)", () => {
    const { errors } = parseIngredientLines([
      { name: "ui", quantity: "1 ½", unit: "" },
      { name: "kaas", quantity: "abc", unit: "" },
    ]);

    expect(errors).toEqual([
      { index: 1, field: "quantity", message: "Hoeveelheid moet een getal zijn" },
    ]);
  });

  it("marks the later of two rows spelling the same name, not the first (B3)", () => {
    const { errors } = parseIngredientLines([
      { name: "ui", quantity: "", unit: "" },
      { name: " UI ", quantity: "", unit: "" },
    ]);

    expect(errors).toEqual([{ index: 1, field: "name", message: "Staat al in dit recept" }]);
  });

  it("indexes errors by the row's position in the form, blank rows included", () => {
    const { errors } = parseIngredientLines([
      { name: "", quantity: "", unit: "" },
      { name: "ui", quantity: "x", unit: "" },
    ]);

    expect(errors.map((error) => error.index)).toEqual([1]);
  });
});
