// The Recepten module as a screen holds it: what data.ts assembles and what
// the components render, named in one place that neither of them owns. See
// geld/view.ts for the same split and why it exists.

export type RecipeTagView = { id: number; name: string };

/** One row in the recipe list: enough to render a card, nothing more. */
export type RecipeSummary = {
  id: number;
  title: string;
  tags: RecipeTagView[];
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
  instructions: string;
  tags: RecipeTagView[];
  ingredients: RecipeIngredientView[];
  /** Every ingredient is on the shared list and not yet bought. */
  onList: boolean;
};

/** An ingredient name already in the household's vocabulary, for autocomplete. */
export type IngredientName = { id: number; name: string };
