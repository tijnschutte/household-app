'use server';

import prisma from '@/src/lib/db/db';
import { schema } from "@/src/lib/schema";
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
        


const groceryItemSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s-_]+$/, "Name contains invalid characters"),
});

export async function createGroceryItem(name: string, userId: number | undefined, householdId: number | undefined) {
  try {
    const validatedData = groceryItemSchema.parse({ name });
    const sanitizedName = validatedData.name.trim().toLowerCase();
    
    const storedItem = await prisma.grocery.findFirst({
      where: {
        name: sanitizedName,
        userId: userId,
        householdId: householdId,
      },
    });
    if (storedItem) {
      throw new Error('Item already exists in your list');
    }
    const groceryItem = await prisma.grocery.create({
      data : {
        name : sanitizedName,
        userId : userId,
        householdId : householdId,
      },
    });
    return groceryItem;
  } catch (error) {
    console.error('Failed to create grocery:', error);
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.errors[0].message}`);
    }
    throw new Error('Failed to create grocery item');
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

export async function updateGroceryItem(id: number, name: string) {
  try {
    const validatedData = groceryItemSchema.parse({ name });
    const sanitizedName = validatedData.name.trim().toLowerCase();
    
    const updatedItem = await prisma.grocery.update({
      where: { id: id },
      data: { name: sanitizedName },
    });
    return updatedItem;
  } catch (error) {
    console.error('Failed to update grocery:', error);
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.errors[0].message}`);
    }
    throw new Error('Failed to update grocery item');
  }
}

export async function markItemsAsBought(ids: number[]) {
  try {
    await prisma.grocery.updateMany({
      where: { id: { in: ids } },
      data: { bought: true },
    });
  } catch (error) {
    console.error('Failed to mark items as bought:', error);
    throw new Error('Failed to mark items as bought');
  }
}

export async function clearCompletedItems(userId: number, householdId?: number) {
  try {
    await prisma.grocery.deleteMany({
      where: {
        bought: true,
        OR: [
          { userId: userId },
          { householdId: householdId }
        ]
      },
    });
  } catch (error) {
    console.error('Failed to clear completed items:', error);
    throw new Error('Failed to clear completed items');
  }
}

export async function deleteItems(ids: number[], userId: number, householdId?: number) {
  try {
    // Verify user has permission to delete these items
    await prisma.grocery.deleteMany({
      where: {
        id: { in: ids },
        OR: [
          { userId: userId },
          { householdId: householdId }
        ]
      },
    });
  } catch (error) {
    console.error('Failed to delete grocery:', error);
    throw new Error('Failed to delete grocery.');
  }
}