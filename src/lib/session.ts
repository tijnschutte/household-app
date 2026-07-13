import { cache } from "react";
import { auth } from "@/src/lib/auth";
import db from "@/src/lib/db/db";

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
    householdId: number | null;
  }> => {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Niet ingelogd");
    }

    const userId = Number(session.user.id);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { householdId: true },
    });

    if (!user) {
      throw new Error("Niet ingelogd");
    }

    return { userId, householdId: user.householdId };
  }
);
