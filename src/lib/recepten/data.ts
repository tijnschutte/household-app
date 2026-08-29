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

/** Just enough of every recipe for the "past bij je lijstje" match (recepten/list-match.ts). */
export async function getRecipesForListMatch(): Promise<
  { id: number; title: string; ingredientNames: string[] }[]
> {
  const { householdId } = await requireHousehold();

  const recipes = await prisma.recipe.findMany({
    where: { householdId },
    include: { ingredients: { include: { ingredient: true } } },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    ingredientNames: recipe.ingredients.map((line) => line.ingredient.name),
  }));
}
