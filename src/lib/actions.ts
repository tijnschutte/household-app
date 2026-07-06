'use server';

import prisma from '@/src/lib/db/db';
import { schema, groceryItemSchema, categorySchema } from "@/src/lib/schema";
import db from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import { requireUser } from "@/src/lib/session";
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

// Builds a where-clause fragment that scopes a query to rows the caller
// owns: either their household's shared rows, or their own personal rows.
// Never trust a client-supplied householdId/userId for this.
function scopeWhere(userId: number, householdId: number | null) {
  return householdId != null ? { OR: [{ householdId }, { userId }] } : { userId };
}

export const signUp = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const username = formData.get("username");
      const password = formData.get("password");
      const validatedData = schema.parse({ username, password });
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      await db.user.create({
        data: {
          name: validatedData.username,
          password: hashedPassword,
        },
      });
    },
    successMessage: "Account succesvol aangemaakt",
  });
};

export const findHomeByUserId = async (userId: number | undefined) => {
  try {
    const household = await prisma.household.findFirst({
      where: {
        members: {
          some: {
            id: userId,
          },
        },
      },
    });
    return household;
  } catch (error) {
    console.error('Failed to fetch household:', error);
    return null;
  }
}

export async function createGroceryItem(name: string, personal: boolean) {
  try {
    const { userId, householdId } = await requireUser();

    if (!personal && !householdId) {
      throw new Error("Je bent niet lid van een huishouden");
    }

    const validated = groceryItemSchema.parse({ name });
    const itemName = validated.name.trim().toLowerCase();

    const groceryItem = await prisma.grocery.create({
      data: personal
        ? { name: itemName, userId, householdId: null }
        : { name: itemName, householdId, userId: null },
    });
    return groceryItem;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`"${name}" staat al in je lijst`);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to create grocery:', error);
    throw new Error('Toevoegen aan lijst mislukt');
  }
}

export async function buyGroceryItem(id: number) {
  try {
    const { userId, householdId } = await requireUser();
    const result = await prisma.grocery.updateMany({
      where: { id, ...scopeWhere(userId, householdId) },
      data: { bought: true },
    });
    if (result.count === 0) {
      throw new Error('Kopen mislukt');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to buy grocery:', error);
    throw new Error('Kopen mislukt');
  }
}

export async function deleteItems(ids: number[]) {
  try {
    const { userId, householdId } = await requireUser();
    const result = await prisma.grocery.deleteMany({
      where: {
        id: { in: ids },
        ...scopeWhere(userId, householdId),
      },
    });
    if (result.count === 0) {
      throw new Error('Verwijderen mislukt');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to delete grocery:', error);
    throw new Error('Verwijderen mislukt');
  }
}

export const createHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const name = formData.get("name") as string;
      const userId = formData.get("userId") as string;

      if (!name || !userId) {
        throw new Error("Naam en gebruikers-ID zijn vereist");
      }

      const trimmedName = name.trim();

      // Check if household name already exists
      const existingHousehold = await db.household.findUnique({
        where: { name: trimmedName }
      });

      if (existingHousehold) {
        throw new Error("Een huishouden met deze naam bestaat al. Kies een andere naam.");
      }

      // Generate a random secret for the household using crypto
      const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const shortSecret = randomString.slice(0, 12).toUpperCase();

      const household = await db.household.create({
        data: {
          name: trimmedName,
          secret: shortSecret,
          members: {
            connect: { id: parseInt(userId) }
          }
        },
      });

      return household;
    },
    successMessage: "Huishouden succesvol aangemaakt",
  });
};

export const joinHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const secret = formData.get("secret") as string;
      const userId = formData.get("userId") as string;

      if (!secret || !userId) {
        throw new Error("Code en gebruikers-ID zijn vereist");
      }

      const household = await db.household.findUnique({
        where: { secret: secret.trim().toUpperCase() }
      });

      if (!household) {
        throw new Error("Ongeldige huishoudcode");
      }

      await db.user.update({
        where: { id: parseInt(userId) },
        data: { householdId: household.id }
      });

      return household;
    },
    successMessage: "Succesvol deelgenomen aan huishouden",
  });
};

export const leaveHousehold = async (userId: number) => {
  return executeAction({
    actionFn: async () => {
      if (!userId) {
        throw new Error("Gebruikers-ID is vereist");
      }

      await db.user.update({
        where: { id: userId },
        data: { householdId: null }
      });
    },
    successMessage: "Huishouden succesvol verlaten",
  });
};

export async function createCategory(name: string, personal: boolean) {
  try {
    const { userId, householdId } = await requireUser();

    if (!personal && !householdId) {
      throw new Error("Je bent niet lid van een huishouden");
    }

    const validated = categorySchema.parse({ name });
    const trimmedName = validated.name;

    const category = await prisma.category.create({
      data: personal
        ? { name: trimmedName, userId, householdId: null }
        : { name: trimmedName, householdId, userId: null },
    });

    return category;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`Categorie "${name}" bestaat al`);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to create category:', error);
    throw new Error('Aanmaken categorie mislukt');
  }
}

export async function deleteCategory(id: number) {
  try {
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
      throw new Error('Verwijderen categorie mislukt');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to delete category:', error);
    throw new Error('Verwijderen categorie mislukt');
  }
}

export async function updateGroceryCategory(groceryId: number, categoryId: number | null) {
  try {
    const { userId, householdId } = await requireUser();
    const scope = scopeWhere(userId, householdId);

    if (categoryId !== null) {
      // The target category must belong to the caller's own scope too,
      // otherwise an item could be linked into another household's category.
      const category = await prisma.category.findFirst({
        where: { id: categoryId, ...scope },
      });
      if (!category) {
        throw new Error('Categorie niet gevonden');
      }
    }

    const result = await prisma.grocery.updateMany({
      where: { id: groceryId, ...scope },
      data: { categoryId },
    });
    if (result.count === 0) {
      throw new Error('Bijwerken categorie mislukt');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to update grocery category:', error);
    throw new Error('Bijwerken categorie mislukt');
  }
}

export async function updateGroceryName(groceryId: number, name: string) {
  try {
    const { userId, householdId } = await requireUser();
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Naam mag niet leeg zijn');
    }

    const result = await prisma.grocery.updateMany({
      where: { id: groceryId, ...scopeWhere(userId, householdId) },
      data: { name: trimmedName },
    });
    if (result.count === 0) {
      throw new Error('Bijwerken naam mislukt');
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(`"${name}" staat al in je lijst`);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to update grocery name:', error);
    throw new Error('Bijwerken naam mislukt');
  }
}
