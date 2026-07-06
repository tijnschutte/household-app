"use server"
import prisma from "@/src/lib/db/db";
import { Household } from "@prisma/client";
import { requireUser } from "@/src/lib/session";

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


export async function getHomeData(personal: boolean) {
    const { userId, householdId } = await requireUser();

    try {
        // No household and not asking for the personal list: nothing to scope to.
        if (!personal && !householdId) {
            return { items: [], categories: [] };
        }

        const [items, categories] = await Promise.all([
            prisma.grocery.findMany({
                where: personal
                    ? { userId, householdId: null, bought: false }
                    : { householdId, bought: false },
                include: {
                    category: true,
                },
                orderBy: [
                    { categoryId: 'asc' }, // null values (uncategorized) come first
                    { name: 'asc' },
                ],
            }),
            prisma.category.findMany({
                where: personal
                    ? { userId, householdId: null }
                    : { householdId },
                orderBy: { name: 'asc' },
            }),
        ]);

        return { items, categories };

    } catch (error) {
        console.error('Failed to fetch home data:', error);
        throw new Error('Ophalen van gegevens mislukt');
    }
}
