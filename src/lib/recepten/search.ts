// The list screen's own filter: a title substring plus a tag selection,
// applied together. Pure, so the screen's "which recipes are showing" logic
// can be tested without rendering it.

import type { RecipeSummary } from "@/src/lib/recepten/view";

/**
 * Selecting more tags narrows rather than widens: "Vega" and "Snel" together
 * means quick vegetarian recipes, which is what someone choosing what to cook
 * tonight is asking. An empty selection means every recipe.
 */
export function filterRecipes(
  recipes: RecipeSummary[],
  query: string,
  selectedTagIds: number[]
): RecipeSummary[] {
  const needle = query.trim().toLowerCase();

  return recipes.filter((recipe) => {
    const matchesQuery = needle === "" || recipe.title.toLowerCase().includes(needle);
    const matchesTags = selectedTagIds.every((id) => recipe.tags.some((tag) => tag.id === id));
    return matchesQuery && matchesTags;
  });
}
