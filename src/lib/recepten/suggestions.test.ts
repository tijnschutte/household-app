import { describe, expect, it } from "vitest";
import { suggestRecipes, type RecipeForSuggestion } from "@/src/lib/recepten/suggestions";

function aRecipe(overrides: Partial<RecipeForSuggestion> = {}): RecipeForSuggestion {
  return { id: 1, title: "Pasta", ingredientNames: ["pasta", "tomaat"], ...overrides };
}

describe("suggestRecipes", () => {
  it("drops a recipe that shares nothing", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui"] });
    const other = aRecipe({ id: 2, title: "Tomatensoep", ingredientNames: ["tomaat"] });

    expect(suggestRecipes(base, [other])).toEqual([]);
  });

  it("never suggests the recipe itself, even if it appears in the list", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["pasta"] });

    expect(suggestRecipes(base, [base])).toEqual([]);
  });

  it("reports which names are shared, in the other recipe's own spelling", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["pasta", "basilicum"] });
    const other = aRecipe({ id: 2, title: "Tomatensoep", ingredientNames: ["Pasta", "ui"] });

    expect(suggestRecipes(base, [other])).toEqual([
      { recipeId: 2, title: "Tomatensoep", shared: ["Pasta"] },
    ]);
  });

  it("ranks a small recipe with more overlap above a big recipe with less, by Jaccard similarity", () => {
    // The base recipe has 3 ingredients. "Klein" is a 3-ingredient recipe
    // sharing 2 of them (similarity 2/4 = 0.5). "Groot" is a 20-ingredient
    // recipe sharing only 1 (similarity 1/22 ≈ 0.045) — it must rank below
    // "Klein" even though a lesser algorithm counting raw overlap alone would
    // still get this one right; Jaccard is what keeps a recipe overwhelmingly
    // different in size from swamping the ranking.
    const base = aRecipe({ id: 1, ingredientNames: ["ui", "kaas", "melk"] });
    const groot = aRecipe({
      id: 2,
      title: "Groot",
      ingredientNames: ["ui", ...Array.from({ length: 19 }, (_, i) => `ingredient-${i}`)],
    });
    const klein = aRecipe({ id: 3, title: "Klein", ingredientNames: ["ui", "kaas", "peper"] });

    const result = suggestRecipes(base, [groot, klein]);

    expect(result.map((s) => s.recipeId)).toEqual([3, 2]);
  });

  it("breaks a similarity tie by shared count, then by title", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui", "kaas", "melk", "peper"] });
    // Both share 1 of 4 -> same union size (5) -> same similarity (1/5).
    const a = aRecipe({ id: 2, title: "Bonen", ingredientNames: ["ui"] });
    const b = aRecipe({ id: 3, title: "Aardappels", ingredientNames: ["ui"] });

    expect(suggestRecipes(base, [a, b]).map((s) => s.title)).toEqual(["Aardappels", "Bonen"]);
  });

  it("keeps only the top 5", () => {
    const base = aRecipe({ id: 1, ingredientNames: ["ui"] });
    const others = Array.from({ length: 8 }, (_, i) =>
      aRecipe({ id: i + 2, title: `Recept ${i}`, ingredientNames: ["ui"] })
    );

    expect(suggestRecipes(base, others)).toHaveLength(5);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const base = aRecipe({ id: 1, ingredientNames: [" Ui "] });
    const other = aRecipe({ id: 2, title: "Soep", ingredientNames: ["ui"] });

    expect(suggestRecipes(base, [other])).toEqual([{ recipeId: 2, title: "Soep", shared: ["ui"] }]);
  });
});
