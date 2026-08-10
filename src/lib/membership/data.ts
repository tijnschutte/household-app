import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import type { HouseholdWithMembers } from "@/src/lib/membership/view";

/**
 * The caller's own household, members included.
 *
 * The id comes from the session and never from an argument: the row returned
 * here carries `secret` — the code needed to join the household — so taking an
 * id would hand that to any caller willing to guess an integer.
 */
export async function getCurrentHousehold(): Promise<HouseholdWithMembers | null> {
  const { userId } = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      household: {
        include: { members: { select: { id: true, name: true } } },
      },
    },
  });

  return user?.household ?? null;
}
