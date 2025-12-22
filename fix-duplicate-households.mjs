import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicates() {
  try {
    // Get all households
    const households = await prisma.household.findMany({
      orderBy: { id: 'asc' }
    });

    console.log(`Found ${households.length} households`);

    // Track names we've seen
    const seenNames = new Set();

    for (const household of households) {
      if (seenNames.has(household.name)) {
        // This is a duplicate, rename it
        const newName = `${household.name} (${household.id})`;
        console.log(`Renaming duplicate "${household.name}" to "${newName}"`);

        await prisma.household.update({
          where: { id: household.id },
          data: { name: newName }
        });
      } else {
        seenNames.add(household.name);
      }
    }

    console.log('Done fixing duplicates!');

  } catch (error) {
    console.error('Error fixing duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDuplicates();
