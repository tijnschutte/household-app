import { notFound } from "next/navigation";
import { requireMembership } from "@/src/lib/membership/gate";
import { getIngredientNames, getRecipe, getRecipeTags } from "@/src/lib/recepten/data";
import { updateRecipe } from "@/src/lib/recepten/actions";
import RecipeForm from "@/src/components/recepten/recipe-form";

export default async function BewerkReceptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMembership();

  const { id } = await params;
  const recipeId = Number(id);

  const [recipe, tags, ingredientNames] = await Promise.all([
    getRecipe(recipeId),
    getRecipeTags(),
    getIngredientNames(),
  ]);
  if (!recipe) {
    notFound();
  }

  return (
    <RecipeForm
      pageTitle="Recept bewerken"
      initial={recipe}
      existingTags={tags}
      ingredientNames={ingredientNames}
      onSubmit={async (input) => {
        "use server";
        const result = await updateRecipe(recipeId, input);
        return result.success
          ? { success: true, message: result.message, value: { id: recipeId } }
          : result;
      }}
    />
  );
}
