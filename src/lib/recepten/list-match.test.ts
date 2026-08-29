import { describe, expect, it } from "vitest";
import { matchRecipesToList, type RecipeForMatch } from "@/src/lib/recepten/list-match";

function aRecipe(overrides: Partial<RecipeForMatch> = {}): RecipeForMatch {
  return { id: 1, title: "Pasta", ingredientNames: ["pasta", "tomaat"], ...overrides };
}

describe("matchRecipesToList", () => {
  it("drops a recipe with nothing on the list", () => {
    const result = matchRecipesToList(["ui"], [aRecipe()]);

    expect(result).toEqual([]);
  });

  it("keeps a recipe with at least one match and reports have/total/missing", () => {
    const result = matchRecipesToList(["pasta"], [aRecipe({ id: 1, title: "Pasta" })]);

    expect(result).toEqual([
      { recipeId: 1, title: "Pasta", have: 1, total: 2, missing: ["tomaat"] },
    ]);
  });

  it("counts a bought item on the list as having it", () => {
    // list-match only sees names; the caller passes bought items in too — this
    // test documents that inclusion rather than exercising a bought flag.
    const result = matchRecipesToList(["pasta", "tomaat"], [aRecipe()]);

    expect(result[0]).toMatchObject({ have: 2, total: 2, missing: [] });
  });

  it("sorts by coverage, then by raw count, then by title", () => {
    const full = aRecipe({ id: 1, title: "Volledig", ingredientNames: ["ui"] });
    const halfBig = aRecipe({
      id: 2,
      title: "Half groot",
      ingredientNames: ["ui", "kaas", "melk", "ei"],
    });
    const halfSmall = aRecipe({ id: 3, title: "Half klein", ingredientNames: ["ui", "kaas"] });

    const result = matchRecipesToList(["ui", "kaas"], [halfBig, full, halfSmall]);

    // full and halfSmall both cover 100% of their own ingredients; halfSmall
    // wins the tie on raw count (2 matched vs 1), then halfBig trails on coverage.
    expect(result.map((m) => m.title)).toEqual(["Half klein", "Volledig", "Half groot"]);
  });

  it("breaks a coverage tie by title", () => {
    const b = aRecipe({ id: 1, title: "Bonen", ingredientNames: ["ui"] });
    const a = aRecipe({ id: 2, title: "Aardappels", ingredientNames: ["ui"] });

    const result = matchRecipesToList(["ui"], [b, a]);

    expect(result.map((m) => m.title)).toEqual(["Aardappels", "Bonen"]);
  });

  it("keeps only the top 5", () => {
    const recipes = Array.from({ length: 8 }, (_, i) =>
      aRecipe({ id: i, title: `Recept ${i}`, ingredientNames: ["ui"] })
    );

    const result = matchRecipesToList(["ui"], recipes);

    expect(result).toHaveLength(5);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const result = matchRecipesToList([" Ui "], [aRecipe({ ingredientNames: ["ui"] })]);

    expect(result[0]).toMatchObject({ have: 1 });
  });
});
