import { redirect } from "next/navigation";
import { getCurrentHousehold } from "@/src/lib/membership/data";
import { requireSignedIn } from "@/src/lib/membership/gate";
import { createHousehold, joinHousehold } from "@/src/lib/membership/actions";
import HouseholdSetupClient from "./household-setup-client";

export default async function HouseholdSetupPage() {
  await requireSignedIn();

  const household = await getCurrentHousehold();

  if (household) {
    redirect("/home");
  }

  return (
    <HouseholdSetupClient onCreateHousehold={createHousehold} onJoinHousehold={joinHousehold} />
  );
}
