import { redirect } from "next/navigation";
import { getCurrentHousehold } from "@/src/lib/membership/data";
import { NotSignedInError, requireUser } from "@/src/lib/session";
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
  try {
    // requireUser also checks the user row still exists, not just the JWT —
    // a session for a deleted user (e.g. after a `db:reset`) must land on
    // /sign-in rather than crash the page.
    const { userId } = await requireUser();
    return { userId };
  } catch (error) {
    if (error instanceof NotSignedInError) {
      redirect("/sign-in");
    }
    throw error;
  }
}

/**
 * Whether the caller has a session for a user that still exists — the check
 * `/`, `/sign-in` and `/sign-up` use to bounce an already-authenticated
 * visitor away from the auth pages. Unlike `requireSignedIn`, "no" is not a
 * failure here, so this returns a boolean instead of redirecting: those pages
 * decide for themselves what to render when it's false, and a session for a
 * deleted user must read as "no" here too, or `/` and `/sign-in` bounce a
 * visitor back and forth forever instead of ever reaching `requireSignedIn`.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    await requireUser();
    return true;
  } catch (error) {
    if (error instanceof NotSignedInError) {
      return false;
    }
    throw error;
  }
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
