import { auth } from "@/src/lib/auth";
import db from "@/src/lib/db/db";

/**
 * Derives the authenticated caller's scope (userId + householdId) from the
 * session and the database — never from client-supplied input. Every server
 * action / data fetch that touches Grocery or Category rows should call this
 * first and use the returned scope to build its `where` clause.
 */
export async function requireUser(): Promise<{ userId: number; householdId: number | null }> {
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
