import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import HouseholdSetupClient from "./household-setup-client";

export default async function HouseholdSetupPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (household) {
    redirect("/home");
  }

  return <HouseholdSetupClient userId={session.user.id as string} />;
}
