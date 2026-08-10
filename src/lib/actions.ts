"use server";

import prisma from "@/src/lib/db/db";
import { schema, groceryItemSchema, categorySchema } from "@/src/lib/schema";
import db from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import { DomainError } from "@/src/lib/domain-error";
import { requireUser } from "@/src/lib/session";
import { notifyHousehold } from "@/src/lib/notifications/notify";
import { groceryAdded, memberJoined } from "@/src/lib/notifications/topics";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";

/**
 * Actions here come in two shapes, and which one an action takes is decided by
 * whether the caller needs something back from it.
 *
 * Wrapped in `executeAction`, returning an ActionResult: the user has to read a
 * specific sentence ("staat al in je lijst", "Ongeldige huishoudcode") or the
 * screen needs the row that was written. Those failures are thrown as a
 * DomainError and arrive at the client as a value, because Next redacts the
 * message of anything thrown out of a server action.
 *
 * Plain and throwing: nothing to say and nothing to hand back. A zero row count
 * means the row was deleted underneath the caller or was never theirs — a race
 * or a client bug, not a choice the user can act on. The screen reverts its
 * optimistic update and supplies its own copy, so a message from here would
 * only be redacted on the way out.
 */

// Builds a where-clause fragment that scopes a query to rows the caller
// owns: either their household's shared rows, or their own personal rows.
// Never trust a client-supplied householdId/userId for this.
function scopeWhere(userId: number, householdId: number | null) {
  return householdId != null ? { OR: [{ householdId }, { userId }] } : { userId };
}

/**
 * Runs a write whose unique constraint the user can trip by hand — typing a
 * name that is already on the list — and reports that collision as copy they
 * can act on, rather than a Prisma error code.
 */
async function rejectingDuplicates<T>(write: () => Promise<T>, message: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError(message);
    }
    throw error;
  }
}

export const signUp = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const username = formData.get("username");
      const password = formData.get("password");
      const validatedData = schema.parse({ username, password });
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      await rejectingDuplicates(
        () =>
          db.user.create({
            data: {
              name: validatedData.username,
              password: hashedPassword,
            },
          }),
        "Gebruikersnaam bestaat al"
      );
    },
    successMessage: "Account succesvol aangemaakt",
  });
};

export async function createGroceryItem(
  name: string,
  personal: boolean,
  categoryId?: number | null
) {
  return executeAction({
    successMessage: "Toegevoegd",
    actionFn: async () => {
      const { userId, name: actorName, householdId } = await requireUser();

      if (!personal && !householdId) {
        throw new DomainError("Je bent niet lid van een huishouden");
      }

      const validated = groceryItemSchema.parse({ name });
      const itemName = validated.name.trim().toLowerCase();

      // The target category must belong to the exact same list the item is
      // created in (personal ↔ user-owned, shared ↔ household-owned), so a
      // client can't link an item into another household's/user's category.
      const targetCategoryId = categoryId ?? null;
      if (targetCategoryId !== null) {
        const category = await prisma.category.findFirst({
          where: personal
            ? { id: targetCategoryId, userId, householdId: null }
            : { id: targetCategoryId, householdId },
        });
        if (!category) {
          throw new DomainError("Categorie niet gevonden");
        }
      }

      const groceryItem = await rejectingDuplicates(
        () =>
          prisma.grocery.create({
            data: personal
              ? { name: itemName, userId, householdId: null, categoryId: targetCategoryId }
              : { name: itemName, householdId, userId: null, categoryId: targetCategoryId },
          }),
        `"${name}" staat al in je lijst`
      );

      // Nobody to tell about a personal list. `after` runs this once the
      // response is on its way, so the push service's latency never lands on
      // the person waiting for their item to appear.
      if (!personal && householdId != null) {
        after(() =>
          notifyHousehold({
            householdId,
            actorUserId: userId,
            notification: groceryAdded(actorName, itemName),
          })
        );
      }

      return groceryItem;
    },
  });
}

export async function setGroceryBought(id: number, bought: boolean) {
  const { userId, householdId } = await requireUser();
  const result = await prisma.grocery.updateMany({
    where: { id, ...scopeWhere(userId, householdId) },
    data: { bought },
  });
  if (result.count === 0) {
    throw new Error("Bijwerken mislukt");
  }
}

// Recreates items that were just removed via deleteItems, for the "Ongedaan
// maken" undo action. Each item carries enough info to reconstruct it within
// the caller's own scope (never a client-supplied household/user id). Items
// are restored in the bought-state they had right before deletion: `bought`
// defaults to true (the WP-4 clear-afgevinkt flow deletes bought items), while
// a swipe-deleted unbought row passes false so undo puts it back on the list.
type RestoreItem = { name: string; categoryId: number | null; personal: boolean; bought?: boolean };

export async function restoreItems(items: RestoreItem[]) {
  const { userId, householdId } = await requireUser();
  const scope = scopeWhere(userId, householdId);

  let restored = 0;
  for (const item of items) {
    if (item.personal && userId == null) continue;
    if (!item.personal && householdId == null) continue;

    // The category must belong to the caller's own scope too, otherwise an
    // item could be linked into another household's category (same check
    // as updateGroceryCategory).
    let categoryId = item.categoryId;
    if (categoryId !== null) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, ...scope },
      });
      if (!category) {
        categoryId = null;
      }
    }

    try {
      const bought = item.bought ?? true;
      await prisma.grocery.create({
        data: item.personal
          ? { name: item.name, userId, householdId: null, categoryId, bought }
          : { name: item.name, householdId, userId: null, categoryId, bought },
      });
      restored++;
    } catch (error) {
      // Unique constraint collision: an item with this name may have been
      // re-added since the delete. Skip it rather than failing the whole undo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  return restored;
}

export async function deleteItems(ids: number[]) {
  const { userId, householdId } = await requireUser();
  const result = await prisma.grocery.deleteMany({
    where: {
      id: { in: ids },
      ...scopeWhere(userId, householdId),
    },
  });
  if (result.count === 0) {
    throw new Error("Verwijderen mislukt");
  }
}

export const createHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const { userId, householdId } = await requireUser();
      if (householdId != null) {
        throw new DomainError("Je zit al in een huishouden");
      }

      const name = formData.get("name") as string;

      if (!name) {
        throw new DomainError("Naam is vereist");
      }

      const trimmedName = name.trim();

      // Generate a random secret for the household using crypto
      const randomString =
        Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const shortSecret = randomString.slice(0, 12).toUpperCase();

      // The unique index is what actually decides the name is taken, so let it
      // decide: a findUnique first would still lose to another member creating
      // the same name in between the read and the write.
      return rejectingDuplicates(
        () =>
          db.household.create({
            data: {
              name: trimmedName,
              secret: shortSecret,
              members: {
                connect: { id: userId },
              },
            },
          }),
        "Een huishouden met deze naam bestaat al. Kies een andere naam."
      );
    },
    successMessage: "Huishouden succesvol aangemaakt",
  });
};

export const joinHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const { userId, name: actorName, householdId } = await requireUser();
      if (householdId != null) {
        throw new DomainError("Je zit al in een huishouden");
      }

      const secret = formData.get("secret") as string;

      if (!secret) {
        throw new DomainError("Code is vereist");
      }

      const household = await db.household.findUnique({
        where: { secret: secret.trim().toUpperCase() },
      });

      if (!household) {
        throw new DomainError("Ongeldige huishoudcode");
      }

      await db.user.update({
        where: { id: userId },
        data: { householdId: household.id },
      });

      after(() =>
        notifyHousehold({
          householdId: household.id,
          actorUserId: userId,
          notification: memberJoined(actorName, household.name),
        })
      );

      return household;
    },
    successMessage: "Succesvol deelgenomen aan huishouden",
  });
};

export const leaveHousehold = async () => {
  return executeAction({
    actionFn: async () => {
      const { userId } = await requireUser();

      await db.user.update({
        where: { id: userId },
        data: { householdId: null },
      });
    },
    successMessage: "Huishouden succesvol verlaten",
  });
};

export async function createCategory(name: string, personal: boolean) {
  return executeAction({
    successMessage: "Categorie aangemaakt",
    actionFn: async () => {
      const { userId, householdId } = await requireUser();

      if (!personal && !householdId) {
        throw new DomainError("Je bent niet lid van een huishouden");
      }

      const validated = categorySchema.parse({ name });
      const trimmedName = validated.name;

      return rejectingDuplicates(
        () =>
          prisma.category.create({
            data: personal
              ? { name: trimmedName, userId, householdId: null }
              : { name: trimmedName, householdId, userId: null },
          }),
        `Categorie "${name}" bestaat al`
      );
    },
  });
}

export async function deleteCategory(id: number) {
  const { userId, householdId } = await requireUser();
  const scope = scopeWhere(userId, householdId);

  // First, unassign all groceries from this category (scoped, so only the
  // caller's own rows in that category are touched)
  await prisma.grocery.updateMany({
    where: { categoryId: id, ...scope },
    data: { categoryId: null },
  });

  // Then delete the category, scoped to the caller
  const result = await prisma.category.deleteMany({
    where: { id, ...scope },
  });

  if (result.count === 0) {
    throw new Error("Verwijderen categorie mislukt");
  }
}

export async function updateGroceryCategory(groceryId: number, categoryId: number | null) {
  const { userId, householdId } = await requireUser();
  const scope = scopeWhere(userId, householdId);

  if (categoryId !== null) {
    // The target category must belong to the caller's own scope too,
    // otherwise an item could be linked into another household's category.
    const category = await prisma.category.findFirst({
      where: { id: categoryId, ...scope },
    });
    if (!category) {
      throw new Error("Categorie niet gevonden");
    }
  }

  const result = await prisma.grocery.updateMany({
    where: { id: groceryId, ...scope },
    data: { categoryId },
  });
  if (result.count === 0) {
    throw new Error("Bijwerken categorie mislukt");
  }
}

export async function updateGroceryName(groceryId: number, name: string) {
  return executeAction({
    successMessage: "Naam bijgewerkt",
    actionFn: async () => {
      const { userId, householdId } = await requireUser();
      // Lowercase like createGroceryItem: names are stored lowercase so the
      // unique constraint dedups case-insensitively and the UI capitalizes.
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName) {
        throw new DomainError("Naam mag niet leeg zijn");
      }

      const result = await rejectingDuplicates(
        () =>
          prisma.grocery.updateMany({
            where: { id: groceryId, ...scopeWhere(userId, householdId) },
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
