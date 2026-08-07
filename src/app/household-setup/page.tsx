import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentHousehold } from "@/src/lib/data";
import { createHousehold, joinHousehold } from "@/src/lib/actions";
import HouseholdSetupClient from "./household-setup-client";

export default async function HouseholdSetupPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getCurrentHousehold();

  if (household) {
    redirect("/home");
  }

  return (
    <HouseholdSetupClient onCreateHousehold={createHousehold} onJoinHousehold={joinHousehold} />
  );
}
