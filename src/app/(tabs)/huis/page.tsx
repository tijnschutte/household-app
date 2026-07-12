import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import HouseholdInfo from "@/src/components/household-info";
import PageHeader from "@/src/components/page-header";
import SignOutButton from "@/src/components/auth/sign-out-button";
import BackButton from "@/src/components/back-button";

export default async function HuisPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (!household) {
    redirect("/household-setup");
  }

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Huis" left={<BackButton />} right={<SignOutButton />} />
      <main className="w-full max-w-2xl mx-auto flex-1 overflow-y-auto px-4 py-4">
        <HouseholdInfo household={household} userId={Number(session.user.id)} />
      </main>
    </div>
  );
}
