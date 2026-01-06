'use server';

import prisma from '@/src/lib/db/db';
import { schema, groceryItemSchema } from "@/src/lib/schema";
import db from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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


export const getAllHouseholds = async () => {
  try {
    const households = await prisma.household.findMany()
    return households;
  } catch (error) {
    console.error('Failed to fetch households:', error);
    return null;
  }
};
        


export async function createGroceryItem(name: string, userId: number | undefined, householdId: number | undefined) {
  try {
    // Validate item name
    const validated = groceryItemSchema.parse({ name });
    const itemName = validated.name.trim().toLowerCase();

    // Build proper where clause - check duplicates in the correct context
    const whereClause = householdId
      ? { name: itemName, householdId: householdId }
      : { name: itemName, userId: userId, householdId: null };

    const storedItem = await prisma.grocery.findFirst({
      where: whereClause,
    });

    if (storedItem) {
      throw new Error(`"${name}" staat al in je lijst`);
    }

    const groceryItem = await prisma.grocery.create({
      data : {
        name : itemName,
        userId : userId,
        householdId : householdId,
      },
    });
    return groceryItem;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
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
    await prisma.grocery.update({
      where: { id: id },
      data: { bought: true },
    });
  } catch (error) {
    console.error('Failed to buy grocery:', error);
    throw new Error('Kopen mislukt');
  }
}

export async function deleteItems(ids: number[]) {
  try {
    await prisma.grocery.deleteMany({
      where: {
          id: { in: ids },
      },
  });
  } catch (error) {
    console.error('Failed to delete grocery:', error);
    throw new Error('Verwijderen mislukt');
  }
}

export const createHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const name = formData.get("name") as string;
      const userId = formData.get("userId") as string;

      console.log("Creating household:", { name, userId });

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

      console.log("Generated secret:", shortSecret);

      const household = await db.household.create({
        data: {
          name: trimmedName,
          secret: shortSecret,
          members: {
            connect: { id: parseInt(userId) }
          }
        },
      });

      console.log("Household created:", household);

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

export async function createCategory(name: string, userId: number | undefined, householdId: number | undefined) {
  try {
    if (!name) {
      throw new Error("Categorienaam is vereist");
    }

    const trimmedName = name.trim();

    // Check for duplicate category name in the same context
    const whereClause = householdId
      ? { name: trimmedName, householdId: householdId }
      : { name: trimmedName, userId: userId, householdId: null };

    const existingCategory = await prisma.category.findFirst({
      where: whereClause,
    });

    if (existingCategory) {
      throw new Error(`Categorie "${name}" bestaat al`);
    }

    const category = await prisma.category.create({
      data: {
        name: trimmedName,
        userId: userId,
        householdId: householdId,
      },
    });

    return category;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Failed to create category:', error);
    throw new Error('Aanmaken categorie mislukt');
  }
}

export async function deleteCategory(id: number) {
  try {
    // First, unassign all groceries from this category
    await prisma.grocery.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    // Then delete the category
    await prisma.category.delete({
      where: { id: id },
    });
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw new Error('Verwijderen categorie mislukt');
  }
}

export async function updateGroceryCategory(groceryId: number, categoryId: number | null) {
  try {
    await prisma.grocery.update({
      where: { id: groceryId },
      data: { categoryId: categoryId },
    });
  } catch (error) {
    console.error('Failed to update grocery category:', error);
    throw new Error('Bijwerken categorie mislukt');
  }
}

export async function updateGroceryName(groceryId: number, name: string) {
  try {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Naam mag niet leeg zijn');
    }
    await prisma.grocery.update({
      where: { id: groceryId },
      data: { name: trimmedName },
    });
  } catch (error) {
    console.error('Failed to update grocery name:', error);
    throw new Error(error instanceof Error ? error.message : 'Bijwerken naam mislukt');
  }
}