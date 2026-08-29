import { cache } from "react";
import { auth } from "@/src/lib/auth";
import db from "@/src/lib/db/db";
import { DomainError } from "@/src/lib/domain-error";

/**
 * The caller has no valid session, or has one for a user row that no longer
 * exists (e.g. a cookie that outlived a `db:reset`). A server action lets
 * this crash — a bug should surface as a stack trace, not a polite redirect.
 * `requireSignedIn` (membership/gate.ts) is the one place that catches it and
 * sends the visitor to /sign-in instead.
 */
export class NotSignedInError extends Error {
  constructor() {
    super("Niet ingelogd");
    this.name = "NotSignedInError";
  }
}

/**
 * Derives the authenticated caller's scope (userId + householdId) from the
 * session and the database — never from client-supplied input. Every server
 * action / data fetch that touches Grocery or Category rows should call this
 * first and use the returned scope to build its `where` clause.
 *
 * Wrapped in React cache() so a page whose data fetches each call this only
 * pays the user lookup once per request.
 */
export const requireUser = cache(
  async (): Promise<{
    userId: number;
    /** Who the household sees in a notification about what this caller did. */
    name: string;
    householdId: number | null;
  }> => {
    const session = await auth();
    if (!session?.user?.id) {
      throw new NotSignedInError();
    }

    const userId = Number(session.user.id);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, householdId: true },
    });

    if (!user) {
      throw new NotSignedInError();
    }

    return { userId, name: user.name, householdId: user.householdId };
  }
);

/**
 * The caller's scope for work that has no personal equivalent — a vaste post,
 * a correction — where "not in a household" is a state the user can be in
 * rather than a bug. The geld page redirects them to setup, but they can still
 * leave the household in another tab with this one open.
 *
 * Returns `householdId` as a plain number, so the actions downstream stop
 * carrying a null they have already ruled out.
 */
export const requireHousehold = async (): Promise<{
  userId: number;
  name: string;
  householdId: number;
}> => {
  const { userId, name, householdId } = await requireUser();
  if (householdId == null) {
    throw new DomainError("Je bent niet lid van een huishouden");
  }
  return { userId, name, householdId };
};
