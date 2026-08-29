// "Past bij je lijstje": which recipes the household is closest to already
// having the ingredients for. Pure and unit-tested — the sheet on /home only
// has to render what this decides.

import type { ListMatch } from "@/src/lib/recepten/view";

export type RecipeForMatch = { id: number; title: string; ingredientNames: string[] };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Scores each recipe by how much of it is already on the list (bought items
 * count as "have" — the point is what's in the house, not what's left to buy),
 * keeps the ones with at least one ingredient on the list, and returns the top
 * 5 sorted by coverage, then by raw count, then by title.
 */
export function matchRecipesToList(listNames: string[], recipes: RecipeForMatch[]): ListMatch[] {
  const onList = new Set(listNames.map(normalize));

  const matches = recipes
    .map((recipe) => {
      const total = recipe.ingredientNames.length;
      const missing = recipe.ingredientNames.filter((name) => !onList.has(normalize(name)));
      const have = total - missing.length;
      return { recipeId: recipe.id, title: recipe.title, have, total, missing };
    })
    .filter((match) => match.have >= 1);

  matches.sort((a, b) => {
    const coverage = b.have / b.total - a.have / a.total;
    if (coverage !== 0) return coverage;
    if (b.have !== a.have) return b.have - a.have;
    return a.title.localeCompare(b.title);
  });

  return matches.slice(0, 5);
}
