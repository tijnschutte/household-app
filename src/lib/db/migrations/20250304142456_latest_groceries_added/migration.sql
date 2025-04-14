-- CreateTable
CREATE TABLE "Grocery" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "bought" BOOLEAN NOT NULL,
    "householdId" INTEGER,

    CONSTRAINT "Grocery_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Grocery" ADD CONSTRAINT "Grocery_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
