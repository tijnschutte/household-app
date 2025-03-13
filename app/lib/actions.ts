'use server';
 
import { signIn } from '@/auth';
import prisma from '@/lib/prisma';
import { AuthError } from 'next-auth';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    const res = await signIn("credentials", {
      redirect: false, 
      name: formData.get("name"),
      password: formData.get("password"),
    });

    if (res?.error) {
      return res.error;
    }

    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  }
}


export async function createHousehold(formData: FormData) {}

export async function createGroceryItem(name: string, userId: number | undefined, householdId: number | undefined) {
  try {
    const storedItem = await prisma.grocery.findFirst({
      where: {
        name: name.toLowerCase(),
        userId: userId,
        householdId: householdId,
      },
    });
    if (storedItem) {
      throw new Error('Item already in db.');
    }
    const groceryItem = await prisma.grocery.create({
      data : {
        name : name.toLowerCase(),
        userId : userId,
        householdId : householdId,
      },
    });
    return groceryItem;
  } catch (error) {
    console.error('Failed to create grocery:', error);
    throw new Error('Failed to create grocery.');
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
          id: { in: ids }, // Deletes all items with these IDs
      },
  });
  } catch (error) {
    console.error('Failed to delete grocery:', error);
    throw new Error('Failed to delete grocery.');
  }
}