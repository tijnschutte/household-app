// The Recepten module as a screen holds it: what data.ts assembles and what
// the components render, named in one place that neither of them owns. See
// geld/view.ts for the same split and why it exists.

import type { ListRow } from "@/src/lib/recepten/basket";

export type RecipeTagView = { id: number; name: string };

/** One row in the recipe list: enough to render a row and to search it. */
export type RecipeSummary = {
  id: number;
  title: string;
  tags: RecipeTagView[];
  /** Normalised names, so the list's search can match on an ingredient too. */
  ingredientNames: string[];
  stepCount: number;
  /** Every ingredient is on the shared list and not yet bought. */
  onList: boolean;
};

export type RecipeIngredientView = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

/** Everything the detail and edit screens need for one recipe. */
export type RecipeDetail = {
  id: number;
  title: string;
  steps: string[];
  tags: RecipeTagView[];
  ingredients: RecipeIngredientView[];
  /**
   * The shared list's rows for this recipe's ingredients, bought or not, so
   * the screen can say per ingredient what "In mandje" would do to the list
   * (recepten/basket.ts) without a second round trip.
   */
  listRows: ListRow[];
};

/** An ingredient name already in the household's vocabulary, for autocomplete. */
export type IngredientName = { id: number; name: string };

/** Just enough of a recipe to rank it against another by shared ingredients. */
export type RecipeForSimilarity = { id: number; title: string; ingredientNames: string[] };
