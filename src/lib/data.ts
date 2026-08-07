"use server";
import prisma from "@/src/lib/db/db";
import { Household } from "@prisma/client";
import { requireUser } from "@/src/lib/session";

export type HouseholdWithMembers = Household & {
  members: { id: number; name: string }[];
};

/**
 * The caller's own household, members included.
 *
 * The id comes from the session and never from an argument: `"use server"` at
 * the top of this module publishes every export as a POST endpoint anyone can
 * call, and the row returned here carries `secret` — the code needed to join
 * the household. Taking the id as a parameter would hand that to any caller
 * willing to guess an integer.
 */
export async function getCurrentHousehold(): Promise<HouseholdWithMembers | null> {
  const { userId } = await requireUser();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        household: {
          include: { members: { select: { id: true, name: true } } },
        },
      },
    });
    return user?.household || null;
  } catch (error) {
    console.error("Failed to fetch household:", error);
    throw new Error("Failed to fetch household.");
  }
}

export async function getHomeData(personal: boolean) {
  const { userId, householdId } = await requireUser();

  try {
    // No household and not asking for the personal list: nothing to scope to.
    if (!personal && !householdId) {
      return { items: [], categories: [] };
    }

    const [items, categories] = await Promise.all([
      prisma.grocery.findMany({
        // Bought items are included too (WP-4: they render in the
        // collapsed "Afgevinkt" section instead of being hidden).
        where: personal ? { userId, householdId: null } : { householdId },
        include: {
          category: true,
        },
        orderBy: [
          { categoryId: "asc" }, // null values (uncategorized) come first
          { name: "asc" },
        ],
      }),
      prisma.category.findMany({
        where: personal ? { userId, householdId: null } : { householdId },
        orderBy: { name: "asc" },
      }),
    ]);

    return { items, categories };
  } catch (error) {
    console.error("Failed to fetch home data:", error);
    throw new Error("Ophalen van gegevens mislukt");
  }
}
