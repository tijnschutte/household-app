import { notFound } from "next/navigation";
import { requireMembership } from "@/src/lib/membership/gate";
import { getRecipe, getRecipesForSimilarity } from "@/src/lib/recepten/data";
import SimilarRecipesClient from "@/src/components/recepten/similar-recipes-client";

export default async function LijktOpPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMembership();

  const { id } = await params;
  const recipeId = Number(id);
  const [recipe, others] = await Promise.all([
    getRecipe(recipeId),
    getRecipesForSimilarity(recipeId),
  ]);
  if (!recipe) {
    notFound();
  }

  return (
    <SimilarRecipesClient
      recipe={{
        id: recipe.id,
        title: recipe.title,
        ingredientNames: recipe.ingredients.map((line) => line.name),
      }}
      others={others}
    />
  );
}
