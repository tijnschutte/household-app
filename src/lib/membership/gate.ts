import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { getCurrentHousehold } from "@/src/lib/membership/data";
import type { HouseholdWithMembers } from "@/src/lib/membership/view";

/**
 * What a page requires before it renders, and where it sends someone who does
 * not have it.
 *
 * This cannot move into the tabs layout, which is where it looks like it
 * belongs: a layout does not re-run when Next navigates between sibling routes
 * on the client, so a member who left their household in one tab would keep
 * rendering /geld in another. Each page asks for itself, and this is the one
 * copy of the policy they all ask.
 */

/** Signed in, and nothing more — the state the household-setup screen exists for. */
export async function requireSignedIn(): Promise<{ userId: number }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return { userId: Number(session.user.id) };
}

/**
 * Signed in and in a household, which every tab needs: there is no shared list
 * and no pot without one.
 */
export async function requireMembership(): Promise<{
  userId: number;
  household: HouseholdWithMembers;
}> {
  const { userId } = await requireSignedIn();

  const household = await getCurrentHousehold();
  if (!household) {
    redirect("/household-setup");
  }

  return { userId, household };
}
