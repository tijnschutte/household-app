import { notFound } from "next/navigation";
import { requireMembership } from "@/src/lib/membership/gate";
import { getRecipe } from "@/src/lib/recepten/data";
import { addRecipeToBasket, deleteRecipe } from "@/src/lib/recepten/actions";
import RecipeDetailClient from "@/src/components/recepten/recipe-detail-client";

export default async function ReceptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMembership();

  const { id } = await params;
  const recipe = await getRecipe(Number(id));
  if (!recipe) {
    notFound();
  }

  return (
    <RecipeDetailClient recipe={recipe} onAddToBasket={addRecipeToBasket} onDelete={deleteRecipe} />
  );
}
