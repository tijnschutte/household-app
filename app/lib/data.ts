"use server"
import prisma from "@/lib/prisma";
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

export async function getHouseholdById(username: string) : Promise<Household | null> {
    try {
        const user = await prisma.user.findUnique({
              where: { name: username },
              include: { household: true }
        });
            return user?.household || null;
    } catch (error) {
        console.error('Failed to fetch household:', error);
        throw new Error('Failed to fetch household.');
    }
}


export async function getGroceryList(householdId: number, bought: boolean) {
    try {
        const groceryList = await prisma.grocery.findMany({
            where: { 
                householdId: householdId,
                bought: bought
             },
        });
        return groceryList;
    } catch (error) {
        console.error('Failed to fetch grocery list:', error);
        throw new Error('Failed to fetch grocery list.');
    }
}