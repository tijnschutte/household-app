import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Delete TijnTest user
    const deletedUser = await prisma.user.deleteMany({
      where: {
        name: 'TijnTest'
      }
    });
    console.log(`Deleted ${deletedUser.count} user(s) named 'TijnTest'`);

    // Delete Huize Hans household
    const deletedHousehold = await prisma.household.deleteMany({
      where: {
        name: 'Huize Hans'
      }
    });
    console.log(`Deleted ${deletedHousehold.count} household(s) named 'Huize Hans'`);

  } catch (error) {
    console.error('Error cleaning up database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
