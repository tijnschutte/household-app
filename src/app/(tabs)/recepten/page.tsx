import { requireMembership } from "@/src/lib/membership/gate";
import { getRecipes, getRecipeTags } from "@/src/lib/recepten/data";
import ReceptenPageClient from "@/src/components/recepten/recepten-page-client";

export default async function ReceptenPage() {
  await requireMembership();

  const [recipes, tags] = await Promise.all([getRecipes(), getRecipeTags()]);

  return <ReceptenPageClient recipes={recipes} tags={tags} />;
}
