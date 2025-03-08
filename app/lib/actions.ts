'use server';
 
import { signIn } from '@/auth';
import prisma from '@/lib/prisma';
import { AuthError } from 'next-auth';
  
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

export async function createHousehold(formData: FormData) {}

export async function createGroceryItem(name: string, userId: number | undefined, householdId: number | undefined) {
  try {
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