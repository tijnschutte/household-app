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
    successMessage: "Signed up successfully",
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
      throw new Error(`"${name}" is already in your list`);
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
    throw new Error('Failed to add item to list');
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
    throw new Error('Failed to buy grocery.');
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
    throw new Error('Failed to delete grocery.');
  }
}

export const createHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const name = formData.get("name") as string;
      const userId = formData.get("userId") as string;

      console.log("Creating household:", { name, userId });

      if (!name || !userId) {
        throw new Error("Name and user ID are required");
      }

      const trimmedName = name.trim();

      // Check if household name already exists
      const existingHousehold = await db.household.findUnique({
        where: { name: trimmedName }
      });

      if (existingHousehold) {
        throw new Error("A household with this name already exists. Please choose a different name.");
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
    successMessage: "Household created successfully",
  });
};

export const joinHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const secret = formData.get("secret") as string;
      const userId = formData.get("userId") as string;

      if (!secret || !userId) {
        throw new Error("Secret and user ID are required");
      }

      const household = await db.household.findUnique({
        where: { secret: secret.trim().toUpperCase() }
      });

      if (!household) {
        throw new Error("Invalid household secret");
      }

      await db.user.update({
        where: { id: parseInt(userId) },
        data: { householdId: household.id }
      });

      return household;
    },
    successMessage: "Joined household successfully",
  });
};

export const leaveHousehold = async (userId: number) => {
  return executeAction({
    actionFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      await db.user.update({
        where: { id: userId },
        data: { householdId: null }
      });
    },
    successMessage: "Left household successfully",
  });
};