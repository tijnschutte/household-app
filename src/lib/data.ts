"use server"
import prisma from "@/src/lib/db/db";
import { Household } from "@prisma/client";

export async function fetchHouseholds() {
    try {
        const households : Household[] = await prisma.household.findMany();
        return households;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch household data.');
    }
}

export async function getHouseholdById(userId: number) : Promise<Household | null> {
    try {
        const user = await prisma.user.findUnique({
              where: { id: userId },
              include: { household: true }
        });
            return user?.household || null;
    } catch (error) {
        console.error('Failed to fetch household:', error);
        throw new Error('Failed to fetch household.');
    }
}


export async function getGroceryList(householdId: number, userId: number, showPersonal: boolean) {
    try {
        let groceryList;

        if (showPersonal) {
            groceryList = await prisma.grocery.findMany({
                where: {
                    userId: userId,
                    bought: false,
                },
                include: {
                    category: true,
                },
                orderBy: [
                    { categoryId: 'asc' }, // null values (uncategorized) come first
                    { name: 'asc' },
                ],
            });
        } else {
            groceryList = await prisma.grocery.findMany({
                where: {
                    householdId: householdId,
                    bought: false
                },
                include: {
                    category: true,
                },
                orderBy: [
                    { categoryId: 'asc' }, // null values (uncategorized) come first
                    { name: 'asc' },
                ],
            });
        }

        return groceryList;

    } catch (error) {
        console.error('Failed to fetch grocery list:', error);
        throw new Error('Failed to fetch grocery list.');
    }
}

export async function getCategories(householdId: number, userId: number, showPersonal: boolean) {
    try {
        let categories;

        if (showPersonal) {
            categories = await prisma.category.findMany({
                where: {
                    userId: userId,
                },
                orderBy: { name: 'asc' },
            });
        } else {
            categories = await prisma.category.findMany({
                where: {
                    householdId: householdId,
                },
                orderBy: { name: 'asc' },
            });
        }

        return categories;

    } catch (error) {
        console.error('Failed to fetch categories:', error);
        throw new Error('Failed to fetch categories.');
    }
}