"use server";

import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { scopeToList } from "@/src/lib/house/scope";

/**
 * `"use server"` here, unlike the other data modules, because the home screen
 * polls this: it is handed down as `onLoadData` and called from the browser
 * every few seconds. Everything the module exports therefore becomes a POST
 * endpoint, so keep it to reads a signed-in caller may make about themselves.
 */
export async function getHomeData(personal: boolean) {
  const { userId, householdId } = await requireUser();

  // No household and not asking for the personal list: nothing to scope to.
  if (!personal && !householdId) {
    return { items: [], categories: [] };
  }

  const list = scopeToList({ userId, householdId }, personal);

  const [items, categories] = await Promise.all([
    prisma.grocery.findMany({
      // Bought items are included too: they render in the collapsed
      // "Afgevinkt" section rather than being hidden.
      where: list,
      include: { category: true },
      orderBy: [
        { categoryId: "asc" }, // null values (uncategorized) come first
        { name: "asc" },
      ],
    }),
    prisma.category.findMany({ where: list, orderBy: { name: "asc" } }),
  ]);

  return { items, categories };
}
