"use server";

import { after } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import { DomainError } from "@/src/lib/domain-error";
import { rejectingDuplicates } from "@/src/lib/db/duplicates";
import { requireUser } from "@/src/lib/session";
import { notifyHousehold } from "@/src/lib/notifications/notify";
import { groceryAdded } from "@/src/lib/notifications/topics";
import { groceryItemSchema, categorySchema } from "@/src/lib/house/schema";
import { ownerOfList, scopeToList, scopeToOwned } from "@/src/lib/house/scope";

/**
 * Actions here come in two shapes, and which one an action takes is decided by
 * whether the caller needs something back from it.
 *
 * Wrapped in `executeAction`, returning an ActionResult: the user has to read a
 * specific sentence ("staat al in je lijst") or the screen needs the row that
 * was written. Those failures are thrown as a DomainError and arrive at the
 * client as a value, because Next redacts the message of anything thrown out of
 * a server action.
 *
 * Plain and throwing: nothing to say and nothing to hand back. A zero row count
 * means the row was deleted underneath the caller or was never theirs — a race
 * or a client bug, not a choice the user can act on. The screen reverts its
 * optimistic update and supplies its own copy, so a message from here would
 * only be redacted on the way out.
 */

/**
 * The category a new or moved row is being filed under, checked to belong to
 * the same list. Without this a client can link an item into another
 * household's category, which is the one way a row can cross a list boundary.
 */
async function categoryOnList(
  categoryId: number | null,
  where: Record<string, unknown>
): Promise<number | null> {
  if (categoryId === null) return null;

  const category = await prisma.category.findFirst({ where: { id: categoryId, ...where } });
  return category?.id ?? null;
}

/** The same check, for the callers that must refuse rather than file the row uncategorized. */
async function requireCategoryOnList(
  categoryId: number | null,
  where: Record<string, unknown>
): Promise<number | null> {
  if (categoryId === null) return null;

  const found = await categoryOnList(categoryId, where);
  if (found === null) {
    throw new DomainError("Categorie niet gevonden");
  }
  return found;
}

export async function createGroceryItem(
  name: string,
  personal: boolean,
  categoryId?: number | null
) {
  return executeAction({
    successMessage: "Toegevoegd",
    actionFn: async () => {
      const caller = await requireUser();
      if (!personal && caller.householdId == null) {
        throw new DomainError("Je bent niet lid van een huishouden");
      }

      const validated = groceryItemSchema.parse({ name });
      // Stored lowercase so the unique constraint dedups regardless of typing;
      // the UI capitalizes for display.
      const itemName = validated.name.trim().toLowerCase();

      const targetCategoryId = await requireCategoryOnList(
        categoryId ?? null,
        scopeToList(caller, personal)
      );

      const groceryItem = await rejectingDuplicates(
        () =>
          prisma.grocery.create({
            data: {
              name: itemName,
              categoryId: targetCategoryId,
              ...ownerOfList(caller, personal),
            },
          }),
        `"${name}" staat al in je lijst`
      );

      // Nobody to tell about a personal list. `after` runs this once the
      // response is on its way, so the push service's latency never lands on
      // the person waiting for their item to appear.
      if (!personal && caller.householdId != null) {
        const { householdId, userId, name: actorName } = caller;
        after(() =>
          notifyHousehold({
            householdId,
            actorUserId: userId,
            notification: groceryAdded(actorName, itemName),
          })
        );
      }

      // Prisma's Decimal is a class instance and cannot cross a server action
      // back to a Client Component — convert it to a plain number here, same
      // as getHomeData does for the polled rows.
      return {
        ...groceryItem,
        quantity: groceryItem.quantity === null ? null : Number(groceryItem.quantity),
      };
    },
  });
}

export async function setGroceryBought(id: number, bought: boolean) {
  const caller = await requireUser();
  const result = await prisma.grocery.updateMany({
    where: { id, ...scopeToOwned(caller) },
    data: { bought },
  });
  if (result.count === 0) {
    throw new Error("Bijwerken mislukt");
  }
}

export async function deleteItems(ids: number[]) {
  const caller = await requireUser();
  const result = await prisma.grocery.deleteMany({
    where: { id: { in: ids }, ...scopeToOwned(caller) },
  });
  if (result.count === 0) {
    throw new Error("Verwijderen mislukt");
  }
}

/**
 * What restoring one deleted item needs. Each carries enough to rebuild the row
 * inside the caller's own scope — never a client-supplied household or user id.
 */
type RestoreItem = {
  name: string;
  categoryId: number | null;
  personal: boolean;
  bought?: boolean;
  quantity?: number | null;
  unit?: string | null;
};

/**
 * Puts back what `deleteItems` just removed, for "Ongedaan maken".
 *
 * `bought` defaults to true because the clear-afgevinkt flow deletes bought
 * items; a swipe-deleted unbought row passes false so undo returns it to the
 * list rather than to the collapsed section.
 */
export async function restoreItems(items: RestoreItem[]) {
  const caller = await requireUser();

  let restored = 0;
  for (const item of items) {
    if (!item.personal && caller.householdId == null) continue;

    // A category from another list is dropped rather than refused: the undo
    // still puts the item back, it just lands uncategorized.
    const categoryId = await categoryOnList(item.categoryId, scopeToOwned(caller));

    try {
      await prisma.grocery.create({
        data: {
          name: item.name,
          categoryId,
          bought: item.bought ?? true,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          ...ownerOfList(caller, item.personal),
        },
      });
      restored++;
    } catch (error) {
      // The name came back while the undo was still on screen. Skip it rather
      // than failing the rest of the batch.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  return restored;
}

export async function updateGroceryName(groceryId: number, name: string) {
  return executeAction({
    successMessage: "Naam bijgewerkt",
    actionFn: async () => {
      const caller = await requireUser();
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName) {
        throw new DomainError("Naam mag niet leeg zijn");
      }

      const result = await rejectingDuplicates(
        () =>
          prisma.grocery.updateMany({
            where: { id: groceryId, ...scopeToOwned(caller) },
            data: { name: trimmedName },
          }),
        `"${name}" staat al in je lijst`
      );

      // No row matched the caller's scope: the item was deleted underneath
      // them, or never theirs. Either way there is nothing to rename.
      if (result.count === 0) {
        throw new DomainError("Bijwerken naam mislukt");
      }
    },
  });
}

export async function updateGroceryCategory(groceryId: number, categoryId: number | null) {
  const caller = await requireUser();
  const scope = scopeToOwned(caller);

  await requireCategoryOnList(categoryId, scope);

  const result = await prisma.grocery.updateMany({
    where: { id: groceryId, ...scope },
    data: { categoryId },
  });
  if (result.count === 0) {
    throw new Error("Bijwerken categorie mislukt");
  }
}

export async function createCategory(name: string, personal: boolean) {
  return executeAction({
    successMessage: "Categorie aangemaakt",
    actionFn: async () => {
      const caller = await requireUser();
      if (!personal && caller.householdId == null) {
        throw new DomainError("Je bent niet lid van een huishouden");
      }

      const validated = categorySchema.parse({ name });

      return rejectingDuplicates(
        () =>
          prisma.category.create({
            data: { name: validated.name, ...ownerOfList(caller, personal) },
          }),
        `Categorie "${name}" bestaat al`
      );
    },
  });
}

export async function deleteCategory(id: number) {
  const caller = await requireUser();
  const scope = scopeToOwned(caller);

  // Deleting a category never deletes what was filed under it: those items
  // fall back to uncategorized, which is what the screen shows optimistically.
  await prisma.grocery.updateMany({
    where: { categoryId: id, ...scope },
    data: { categoryId: null },
  });

  const result = await prisma.category.deleteMany({ where: { id, ...scope } });
  if (result.count === 0) {
    throw new Error("Verwijderen categorie mislukt");
  }
}
