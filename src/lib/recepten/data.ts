import prisma from "@/src/lib/db/db";
import { requireHousehold } from "@/src/lib/session";
import { allOnList, type ListRow } from "@/src/lib/recepten/basket";
import type {
  IngredientName,
  RecipeDetail,
  RecipeForSimilarity,
  RecipeSummary,
  RecipeTagView,
} from "@/src/lib/recepten/view";

/**
 * The shared list's rows, in the shape the merge rule reads. Both Grocery.name
 * and Ingredient.name are stored trimmed and lowercase (schema.ts,
 * house/actions.ts), so the names can be compared as they are.
 */
async function sharedListRows(householdId: number, names?: string[]): Promise<ListRow[]> {
  const rows = await prisma.grocery.findMany({
    where: { householdId, ...(names ? { name: { in: names } } : {}) },
    select: { id: true, name: true, quantity: true, unit: true, bought: true },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    bought: row.bought ?? false,
  }));
}

/** All of the household's recipes, for the list screen. */
export async function getRecipes(): Promise<RecipeSummary[]> {
  const { householdId } = await requireHousehold();

  const [recipes, listRows] = await Promise.all([
    prisma.recipe.findMany({
      where: { householdId },
      include: { tags: true, ingredients: { include: { ingredient: true } } },
      orderBy: { title: "asc" },
    }),
    sharedListRows(householdId),
  ]);

  return recipes.map((recipe) => {
    const ingredientNames = recipe.ingredients.map((line) => line.ingredient.name);
    return {
      id: recipe.id,
      title: recipe.title,
      tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      ingredientNames,
      stepCount: recipe.steps.length,
      onList: allOnList(ingredientNames, listRows),
    };
  });
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

  const listRows = await sharedListRows(
    householdId,
    recipe.ingredients.map((line) => line.ingredient.name)
  );

  return {
    id: recipe.id,
    title: recipe.title,
    steps: recipe.steps,
    tags: recipe.tags.map((tag) => ({ id: tag.id, name: tag.name })),
    ingredients: recipe.ingredients.map((line) => ({
      name: line.ingredient.name,
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
    })),
    listRows,
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
 * Just enough of every other recipe in the household for "Lijkt op"
 * (recepten/similar.ts) to rank against `excludeRecipeId`.
 */
export async function getRecipesForSimilarity(
  excludeRecipeId: number
): Promise<RecipeForSimilarity[]> {
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
