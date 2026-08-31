-- AlterTable
ALTER TABLE "Grocery" ADD COLUMN     "sourceRecipeId" INTEGER;

-- AddForeignKey
ALTER TABLE "Grocery" ADD CONSTRAINT "Grocery_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
