-- AlterTable
ALTER TABLE "Grocery" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "Grocery" ADD CONSTRAINT "Grocery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
