import prisma from "@/src/lib/db/db";
import { requireHousehold } from "@/src/lib/session";
import type {
  IngredientName,
  RecipeDetail,
  RecipeSummary,
  RecipeTagView,
} from "@/src/lib/recepten/view";

/** All of the household's recipes, for the list screen. */
export async function getRecipes(): Promise<RecipeSummary[]> {
  const { householdId } = await requireHousehold();

  const recipes = await prisma.recipe.findMany({
    where: { householdId },
    include: { tags: true },
    orderBy: { title: "asc" },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  }));
}

/** One recipe, or null when it does not exist or belongs to another household. */
export async function getRecipe(id: number): Promise<RecipeDetail | null> {
  const { householdId } = await requireHousehold();

  const recipe = await prisma.recipe.findFirst({
    where: { id, householdId },
    include: {
      tags: true,
      ingredients: { include: { ingredient: true }, orderBy: { position: "asc" } },
    },
  });
  if (!recipe) return null;

  // "Al in mandje": every ingredient of this recipe is already on the shared
  // list and not yet bought. Both Grocery.name and Ingredient.name are stored
  // trimmed and lowercase (schema.ts, house/actions.ts), so a direct set
  // lookup is enough — no re-normalising a value that's already normalised.
  const unbought = await prisma.grocery.findMany({
    where: { householdId, bought: false },
    select: { name: true },
  });
  const namesOnList = new Set(unbought.map((item) => item.name));
  const onList = recipe.ingredients.every((line) => namesOnList.has(line.ingredient.name));

  return {
    id: recipe.id,
    title: recipe.title,
    instructions: recipe.instructions,
    tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    ingredients: recipe.ingredients.map((line) => ({
      name: line.ingredient.name,
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
    })),
    onList,
  };
}

/** The household's own ingredient vocabulary, for the form's autocomplete. */
export async function getIngredientNames(): Promise<IngredientName[]> {
  const { householdId } = await requireHousehold();

  const ingredients = await prisma.ingredient.findMany({
    where: { householdId },
    orderBy: { name: "asc" },
  });

  return ingredients.map((ingredient) => ({ id: ingredient.id, name: ingredient.name }));
}

/** The household's own recipe tags, for the filter chips and the form. */
export async function getRecipeTags(): Promise<RecipeTagView[]> {
  const { householdId } = await requireHousehold();

  const tags = await prisma.recipeTag.findMany({
    where: { householdId },
    orderBy: { name: "asc" },
  });

  return tags.map((tag) => ({ id: tag.id, name: tag.name }));
}

/**
 * Just enough of every other recipe in the household for "Combineer je
 * boodschappen" (recepten/suggestions.ts) to rank against `excludeRecipeId`.
 */
export async function getRecipesForSuggestions(
  excludeRecipeId: number
): Promise<{ id: number; title: string; ingredientNames: string[] }[]> {
  const { householdId } = await requireHousehold();

  const recipes = await prisma.recipe.findMany({
    where: { householdId, NOT: { id: excludeRecipeId } },
    include: { ingredients: { include: { ingredient: true } } },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    ingredientNames: recipe.ingredients.map((line) => line.ingredient.name),
  }));
}
