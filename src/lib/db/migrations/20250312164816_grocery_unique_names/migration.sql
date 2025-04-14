/*
  Warnings:

  - A unique constraint covering the columns `[name,householdId]` on the table `Grocery` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,userId]` on the table `Grocery` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Grocery_name_householdId_key" ON "Grocery"("name", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Grocery_name_userId_key" ON "Grocery"("name", "userId");
