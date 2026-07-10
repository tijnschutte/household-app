import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";

export type DocRow = {
  id: number;
  name: string;
  categoryId: number | null;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedByName: string | null;
};

export type DocCategoryRow = {
  id: number;
  name: string;
};

export type KeyInfoRow = {
  id: number;
  label: string;
  username: string | null;
  password: string;
};

export type DocsData = {
  documents: DocRow[];
  categories: DocCategoryRow[];
  keyInfo: KeyInfoRow[];
};

/**
 * Documents (newest first — grouping by category happens client-side, see
 * src/components/docs/document-list.tsx), the household's doc categories
 * (sorted by name) and key-value info, all scoped to the caller's household.
 */
export async function getDocsData(): Promise<DocsData> {
  const { householdId } = await requireUser();
  if (!householdId) {
    return { documents: [], categories: [], keyInfo: [] };
  }

  const [documents, categories, keyInfo] = await Promise.all([
    prisma.document.findMany({
      where: { householdId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.docCategory.findMany({
      where: { householdId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.keyInfo.findMany({
      where: { householdId },
      select: { id: true, label: true, username: true, password: true },
      orderBy: { label: "asc" },
    }),
  ]);

  return {
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      categoryId: doc.categoryId,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
      uploadedByName: doc.uploadedBy?.name ?? null,
    })),
    categories,
    keyInfo,
  };
}
