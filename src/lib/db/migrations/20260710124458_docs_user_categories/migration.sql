/*
  Warnings:

  - You are about to drop the column `category` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "category",
ADD COLUMN     "categoryId" INTEGER;

-- DropEnum
DROP TYPE "DocCategory";

-- CreateTable
CREATE TABLE "DocCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "householdId" INTEGER NOT NULL,

    CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocCategory_name_householdId_key" ON "DocCategory"("name", "householdId");

-- AddForeignKey
ALTER TABLE "DocCategory" ADD CONSTRAINT "DocCategory_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
