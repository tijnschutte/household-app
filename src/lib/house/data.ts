"use server";

import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { scopeToList } from "@/src/lib/house/scope";
import type { GroceryWithCategory } from "@/src/lib/house/grocery-view";

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
      include: { category: true, sourceRecipe: { select: { title: true } } },
      orderBy: [
        { categoryId: "asc" }, // null values (uncategorized) come first
        { name: "asc" },
      ],
    }),
    prisma.category.findMany({ where: list, orderBy: { name: "asc" } }),
  ]);

  // Prisma's Decimal is a class instance, which Next's server-action
  // serialization cannot carry across to a Client Component — convert it to
  // a plain number here, at the one place every polled row crosses the wire.
  // sourceRecipe collapses to its title alone: the screen shows "van
  // {recept}", never the id, and dependency-cruiser's data.ts rule exists so
  // a raw relation object never has the chance to leak further than this.
  const clientItems: GroceryWithCategory[] = items.map(({ sourceRecipe, ...item }) => ({
    ...item,
    quantity: item.quantity === null ? null : Number(item.quantity),
    sourceRecipeTitle: sourceRecipe?.title ?? null,
  }));

  return { items: clientItems, categories };
}
