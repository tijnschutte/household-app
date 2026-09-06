import { describe, expect, it } from "vitest";
import { recipeSchema } from "@/src/lib/recepten/schema";

function aRecipeInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Pasta pesto",
    steps: ["Kook de pasta.", "Meng met pesto."],
    ingredients: [{ name: "Pasta", quantity: 200, unit: "gram" }],
    tags: ["Snel"],
    ...overrides,
  };
}

describe("recipeSchema", () => {
  it("accepts a well-formed recipe", () => {
    const result = recipeSchema.safeParse(aRecipeInput());

    expect(result.success).toBe(true);
  });

  it("normalises ingredient names to trimmed lowercase", () => {
    const result = recipeSchema.parse(
      aRecipeInput({ ingredients: [{ name: "  Ui  ", quantity: null, unit: null }] })
    );

    expect(result.ingredients[0].name).toBe("ui");
  });

  it("canonicalises the unit, so 'GRAM' and 'g' save as the same unit", () => {
    const result = recipeSchema.parse(
      aRecipeInput({ ingredients: [{ name: "ui", quantity: 1, unit: "GRAM" }] })
    );

    expect(result.ingredients[0].unit).toBe("g");
  });

  it("reads a blank unit as none", () => {
    const result = recipeSchema.parse(
      aRecipeInput({ ingredients: [{ name: "ui", quantity: 1, unit: "  " }] })
    );

    expect(result.ingredients[0].unit).toBeNull();
  });

  it("rejects a second ingredient line with the same normalised name", () => {
    const result = recipeSchema.safeParse(
      aRecipeInput({
        ingredients: [
          { name: "Ui", quantity: 1, unit: null },
          { name: " ui ", quantity: 2, unit: null },
        ],
      })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]).toMatchObject({
        message: "Staat al in dit recept",
        path: ["ingredients", 1, "name"],
      });
    }
  });

  it("rejects an empty title", () => {
    expect(recipeSchema.safeParse(aRecipeInput({ title: "  " })).success).toBe(false);
  });

  it("rejects a title over 80 characters, with the message the form shows under the field", () => {
    const result = recipeSchema.safeParse(aRecipeInput({ title: "a".repeat(81) }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Titel mag maximaal 80 tekens zijn");
    }
  });

  it("drops blank steps and trims the rest", () => {
    const result = recipeSchema.parse(
      aRecipeInput({ steps: ["  Kook de pasta.  ", "", "   ", "Meng met pesto."] })
    );

    expect(result.steps).toEqual(["Kook de pasta.", "Meng met pesto."]);
  });

  it("accepts a recipe with no steps at all", () => {
    expect(recipeSchema.safeParse(aRecipeInput({ steps: [] })).success).toBe(true);
  });

  it("rejects a step over 1000 characters", () => {
    expect(recipeSchema.safeParse(aRecipeInput({ steps: ["a".repeat(1001)] })).success).toBe(false);
  });

  it("rejects more than 50 steps, blank ones not counted", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `Stap ${i}`);
    expect(recipeSchema.safeParse(aRecipeInput({ steps: [...fifty, ""] })).success).toBe(true);
    expect(recipeSchema.safeParse(aRecipeInput({ steps: [...fifty, "Stap 51"] })).success).toBe(
      false
    );
  });

  it("rejects a recipe with no ingredients", () => {
    expect(recipeSchema.safeParse(aRecipeInput({ ingredients: [] })).success).toBe(false);
  });

  it("rejects a zero or negative quantity", () => {
    expect(
      recipeSchema.safeParse(
        aRecipeInput({ ingredients: [{ name: "ui", quantity: 0, unit: null }] })
      ).success
    ).toBe(false);
    expect(
      recipeSchema.safeParse(
        aRecipeInput({ ingredients: [{ name: "ui", quantity: -1, unit: null }] })
      ).success
    ).toBe(false);
  });

  it("rejects a quantity with more than 2 decimals", () => {
    expect(
      recipeSchema.safeParse(
        aRecipeInput({ ingredients: [{ name: "ui", quantity: 1.234, unit: null }] })
      ).success
    ).toBe(false);
  });

  it("accepts a null quantity and a null unit", () => {
    const result = recipeSchema.safeParse(
      aRecipeInput({ ingredients: [{ name: "ui", quantity: null, unit: null }] })
    );

    expect(result.success).toBe(true);
  });

  it("rejects an ingredient name over 40 characters", () => {
    expect(
      recipeSchema.safeParse(
        aRecipeInput({ ingredients: [{ name: "a".repeat(41), quantity: null, unit: null }] })
      ).success
    ).toBe(false);
  });

  it("rejects a unit over 12 characters", () => {
    expect(
      recipeSchema.safeParse(
        aRecipeInput({ ingredients: [{ name: "ui", quantity: 1, unit: "a".repeat(13) }] })
      ).success
    ).toBe(false);
  });
});
