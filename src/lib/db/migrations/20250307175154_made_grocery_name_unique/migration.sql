/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Grocery` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Grocery_name_key" ON "Grocery"("name");
