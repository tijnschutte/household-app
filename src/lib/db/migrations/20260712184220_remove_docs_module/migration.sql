-- DropForeignKey
ALTER TABLE "DocCategory" DROP CONSTRAINT "DocCategory_householdId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_householdId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "KeyInfo" DROP CONSTRAINT "KeyInfo_householdId_fkey";

-- DropTable
DROP TABLE "DocCategory";

-- DropTable
DROP TABLE "Document";

-- DropTable
DROP TABLE "KeyInfo";

