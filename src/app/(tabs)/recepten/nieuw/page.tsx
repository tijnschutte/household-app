import { requireMembership } from "@/src/lib/membership/gate";
import { getIngredientNames, getRecipeTags } from "@/src/lib/recepten/data";
import { createRecipe } from "@/src/lib/recepten/actions";
import RecipeForm from "@/src/components/recepten/recipe-form";

export default async function NieuwReceptPage() {
  await requireMembership();

  const [tags, ingredientNames] = await Promise.all([getRecipeTags(), getIngredientNames()]);

  return (
    <RecipeForm
      pageTitle="Nieuw recept"
      existingTags={tags}
      ingredientNames={ingredientNames}
      onSubmit={createRecipe}
    />
  );
}
