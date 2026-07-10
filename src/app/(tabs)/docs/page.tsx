import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import { getDocsData } from "@/src/lib/docs/data";
import DocsPageClient from "@/src/components/docs/docs-page-client";

export default async function DocsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (!household) {
    redirect("/household-setup");
  }

  const data = await getDocsData();

  return <DocsPageClient data={data} />;
}
