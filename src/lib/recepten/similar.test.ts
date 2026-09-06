import { describe, expect, it } from "vitest";
import { rankBySharedIngredients } from "@/src/lib/recepten/similar";
import type { RecipeForSimilarity } from "@/src/lib/recepten/view";

function aRecipe(overrides: Partial<RecipeForSimilarity> = {}): RecipeForSimilarity {
  return { id: 1, title: "Pasta", ingredientNames: ["pasta", "tomaat"], ...overrides };
}

describe("rankBySharedIngredients", () => {
  it("drops a recipe that shares nothing", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui"] });
    const other = aRecipe({ id: 2, title: "Tomatensoep", ingredientNames: ["tomaat"] });

    expect(rankBySharedIngredients(base, [other])).toEqual([]);
  });

  it("never lists the recipe itself, even if it appears among the others", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["pasta"] });

    expect(rankBySharedIngredients(base, [base])).toEqual([]);
  });

  it("reports shared and missing names in the other recipe's own spelling and order", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["pasta", "basilicum"] });
    const other = aRecipe({
      id: 2,
      title: "Tomatensoep",
      ingredientNames: ["ui", "Pasta", "tomaat"],
    });

    expect(rankBySharedIngredients(base, [other])).toEqual([
      {
        recipeId: 2,
        title: "Tomatensoep",
        shared: ["Pasta"],
        missing: ["ui", "tomaat"],
        ingredientCount: 3,
      },
    ]);
  });

  it("ranks by shared count, most first", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui", "kaas", "melk"] });
    const one = aRecipe({ id: 2, title: "Eén", ingredientNames: ["ui", "peper"] });
    const two = aRecipe({ id: 3, title: "Twee", ingredientNames: ["ui", "kaas", "peper"] });

    expect(rankBySharedIngredients(base, [one, two]).map((s) => s.recipeId)).toEqual([3, 2]);
  });

  it("breaks a tie by fewest missing ingredients, then by title", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui", "kaas"] });
    const needsMore = aRecipe({ id: 2, title: "Aardappels", ingredientNames: ["ui", "a", "b"] });
    const needsLess = aRecipe({ id: 3, title: "Zuurkool", ingredientNames: ["ui", "a"] });
    const sameAsLess = aRecipe({ id: 4, title: "Bonen", ingredientNames: ["ui", "b"] });

    expect(
      rankBySharedIngredients(base, [needsMore, needsLess, sameAsLess]).map((s) => s.title)
    ).toEqual(["Bonen", "Zuurkool", "Aardappels"]);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const base = aRecipe({ id: 1, ingredientNames: [" Ui "] });
    const other = aRecipe({ id: 2, title: "Soep", ingredientNames: ["ui"] });

    expect(rankBySharedIngredients(base, [other])).toHaveLength(1);
  });

  it("narrows to recipes sharing one required ingredient", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui", "kaas"] });
    const withUi = aRecipe({ id: 2, title: "Uiensoep", ingredientNames: ["ui"] });
    const withKaas = aRecipe({ id: 3, title: "Kaasplank", ingredientNames: ["Kaas"] });

    expect(
      rankBySharedIngredients(base, [withUi, withKaas], "kaas").map((s) => s.recipeId)
    ).toEqual([3]);
  });
});
