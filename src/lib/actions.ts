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