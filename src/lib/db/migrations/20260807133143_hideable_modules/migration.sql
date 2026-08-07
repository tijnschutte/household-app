-- CreateEnum
CREATE TYPE "OptionalModule" AS ENUM ('GELD');

-- CreateTable
CREATE TABLE "HiddenModule" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "module" "OptionalModule" NOT NULL,

    CONSTRAINT "HiddenModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HiddenModule_userId_module_key" ON "HiddenModule"("userId", "module");

-- AddForeignKey
ALTER TABLE "HiddenModule" ADD CONSTRAINT "HiddenModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
