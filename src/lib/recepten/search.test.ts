import { describe, expect, it } from "vitest";
import { filterRecipes } from "@/src/lib/recepten/search";
import type { RecipeSummary } from "@/src/lib/recepten/view";

function aRecipe(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 1,
    title: "Pasta pesto",
    tags: [],
    ingredientNames: [],
    stepCount: 0,
    onList: false,
    ...overrides,
  };
}

describe("filterRecipes", () => {
  it("returns everything when the query and the tag selection are both empty", () => {
    const recipes = [aRecipe()];

    expect(filterRecipes(recipes, "", [])).toEqual(recipes);
  });

  it("matches a title substring case-insensitively", () => {
    const recipes = [aRecipe({ title: "Pasta pesto" }), aRecipe({ id: 2, title: "Tomatensoep" })];

    expect(filterRecipes(recipes, "PASTA", [])).toEqual([recipes[0]]);
  });

  it("matches an ingredient name too", () => {
    const withBasil = aRecipe({ id: 1, title: "Caprese", ingredientNames: ["basilicum"] });
    const without = aRecipe({ id: 2, title: "Tomatensoep", ingredientNames: ["ui"] });

    expect(filterRecipes([withBasil, without], "basil", [])).toEqual([withBasil]);
  });

  it("keeps only recipes carrying the selected tag", () => {
    const withTag = aRecipe({ id: 1, tags: [{ id: 9, name: "Snel" }] });
    const withoutTag = aRecipe({ id: 2, tags: [] });

    expect(filterRecipes([withTag, withoutTag], "", [9])).toEqual([withTag]);
  });

  it("narrows to recipes carrying every selected tag, not any of them", () => {
    const both = aRecipe({
      id: 1,
      tags: [
        { id: 9, name: "Snel" },
        { id: 4, name: "Vega" },
      ],
    });
    const onlyOne = aRecipe({ id: 2, tags: [{ id: 9, name: "Snel" }] });

    expect(filterRecipes([both, onlyOne], "", [9, 4])).toEqual([both]);
  });

  it("applies the query and the tag together", () => {
    const match = aRecipe({ id: 1, title: "Pasta pesto", tags: [{ id: 9, name: "Snel" }] });
    const wrongTag = aRecipe({ id: 2, title: "Pasta carbonara", tags: [] });
    const wrongTitle = aRecipe({ id: 3, title: "Tomatensoep", tags: [{ id: 9, name: "Snel" }] });

    expect(filterRecipes([match, wrongTag, wrongTitle], "pasta", [9])).toEqual([match]);
  });
});
