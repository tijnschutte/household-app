// "Lijkt op": which other recipes share ingredients with the one on screen,
// and how many. Pure and unit-tested — the screen only renders what this
// decides.

import type { RecipeForSimilarity } from "@/src/lib/recepten/view";

export type SimilarRecipe = {
  recipeId: number;
  title: string;
  /** In the other recipe's own spelling, in its own order. */
  shared: string[];
  /** What the other recipe needs that this one does not have. */
  missing: string[];
  ingredientCount: number;
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Every other recipe that shares at least one ingredient, most shared first.
 * Raw shared count rather than a similarity ratio: the question on this
 * screen is "what else can I cook with what I am already buying", and that is
 * answered by how much overlaps, not by how little differs. Ties go to the
 * recipe needing the fewest extra ingredients, then to the title.
 *
 * `requiredIngredient` narrows to recipes that share that one ingredient in
 * particular — the chip row on the screen.
 */
export function rankBySharedIngredients(
  recipe: RecipeForSimilarity,
  others: RecipeForSimilarity[],
  requiredIngredient: string | null = null
): SimilarRecipe[] {
  const recipeNames = new Set(recipe.ingredientNames.map(normalize));
  const required = requiredIngredient === null ? null : normalize(requiredIngredient);

  const ranked: SimilarRecipe[] = [];
  for (const other of others) {
    if (other.id === recipe.id) continue;

    const shared = other.ingredientNames.filter((name) => recipeNames.has(normalize(name)));
    if (shared.length === 0) continue;
    if (required !== null && !shared.some((name) => normalize(name) === required)) continue;

    ranked.push({
      recipeId: other.id,
      title: other.title,
      shared,
      missing: other.ingredientNames.filter((name) => !recipeNames.has(normalize(name))),
      ingredientCount: other.ingredientNames.length,
    });
  }

  ranked.sort((a, b) => {
    if (b.shared.length !== a.shared.length) return b.shared.length - a.shared.length;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return a.title.localeCompare(b.title);
  });

  return ranked;
}
