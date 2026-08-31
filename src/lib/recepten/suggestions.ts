// "Combineer je boodschappen": which other recipes are worth cooking together
// with the one on screen, because they share ingredients. Pure and
// unit-tested — the sheet on the recipe detail page only renders what this
// decides.

export type RecipeForSuggestion = { id: number; title: string; ingredientNames: string[] };

export type RecipeSuggestion = { recipeId: number; title: string; shared: string[] };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Ranked by Jaccard similarity (shared ÷ union of the two ingredient sets)
 * rather than raw shared count, so a 20-ingredient recipe that happens to
 * share one thing with `recipe` doesn't outrank a 3-ingredient recipe that
 * shares two — the second recipe is the one actually worth cooking alongside
 * this one. Keeps only recipes sharing at least one ingredient, ties broken
 * by shared count then title, capped at 5.
 */
export function suggestRecipes(
  recipe: RecipeForSuggestion,
  others: RecipeForSuggestion[]
): RecipeSuggestion[] {
  const recipeNames = new Set(recipe.ingredientNames.map(normalize));

  const ranked = others
    .filter((other) => other.id !== recipe.id)
    .map((other) => {
      const otherNames = new Set(other.ingredientNames.map(normalize));
      const union = new Set([...recipeNames, ...otherNames]);
      // Shown in the other recipe's own spelling/casing, not the normalised
      // form used to match them.
      const shared = other.ingredientNames.filter((name) => recipeNames.has(normalize(name)));
      const similarity = union.size === 0 ? 0 : shared.length / union.size;
      return { recipeId: other.id, title: other.title, shared, similarity };
    })
    .filter((suggestion) => suggestion.shared.length >= 1);

  ranked.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    if (b.shared.length !== a.shared.length) return b.shared.length - a.shared.length;
    return a.title.localeCompare(b.title);
  });

  return ranked.slice(0, 5).map(({ recipeId, title, shared }) => ({ recipeId, title, shared }));
}
