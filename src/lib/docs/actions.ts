"use server";

import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { getStorage } from "@/src/lib/storage";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const docNameSchema = z
  .string()
  .trim()
  .min(1, "Naam is vereist")
  .max(60, "Naam mag maximaal 60 karakters zijn");
const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Naam is vereist")
  .max(30, "Naam mag maximaal 30 karakters zijn");
const labelSchema = z
  .string()
  .trim()
  .min(1, "Label is vereist")
  .max(40, "Label mag maximaal 40 karakters zijn");
const valueSchema = z
  .string()
  .trim()
  .min(1, "Waarde is vereist")
  .max(200, "Waarde mag maximaal 200 karakters zijn");

// Verifies a client-supplied categoryId belongs to the caller's household
// (null = uncategorized, always allowed).
async function requireOwnedCategory(categoryId: number | null, householdId: number) {
  if (categoryId === null) return;
  const category = await prisma.docCategory.findFirst({
    where: { id: categoryId, householdId },
  });
  if (!category) {
    throw new Error("Categorie niet gevonden");
  }
}

/** Deletes the row first, then best-effort removes the underlying file — a
 * dangling blob is a harmless cleanup nit, a dangling DB row that points at
 * nothing is a broken download link. */
export async function deleteDocument(id: number) {
  let storageKey: string | null = null;
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const doc = await prisma.document.findFirst({ where: { id, householdId } });
    if (!doc) {
      throw new Error("Document niet gevonden");
    }
    storageKey = doc.storageKey;

    await prisma.document.deleteMany({ where: { id, householdId } });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to delete document:", error);
    throw new Error("Verwijderen mislukt");
  } finally {
    revalidatePath("/docs");
  }

  if (storageKey) {
    try {
      await getStorage().delete(storageKey);
    } catch (error) {
      console.error("Failed to delete stored file for document:", id, error);
    }
  }
}

/** Renames a document and/or moves it to another category (null = "Overig"). */
export async function updateDocument(id: number, name: string, categoryId: number | null) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validName = docNameSchema.parse(name);
    await requireOwnedCategory(categoryId, householdId);

    const result = await prisma.document.updateMany({
      where: { id, householdId },
      data: { name: validName, categoryId },
    });
    if (result.count === 0) {
      throw new Error("Document niet gevonden");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to update document:", error);
    throw new Error("Bijwerken mislukt");
  } finally {
    revalidatePath("/docs");
  }
}

export async function createDocCategory(name: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validName = categoryNameSchema.parse(name);

    const category = await prisma.docCategory.create({
      data: { householdId, name: validName },
      select: { id: true, name: true },
    });
    return category;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Categorie bestaat al");
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to create doc category:", error);
    throw new Error("Aanmaken categorie mislukt");
  } finally {
    revalidatePath("/docs");
  }
}

export async function renameDocCategory(id: number, name: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validName = categoryNameSchema.parse(name);

    const result = await prisma.docCategory.updateMany({
      where: { id, householdId },
      data: { name: validName },
    });
    if (result.count === 0) {
      throw new Error("Categorie niet gevonden");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Categorie bestaat al");
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to rename doc category:", error);
    throw new Error("Hernoemen categorie mislukt");
  } finally {
    revalidatePath("/docs");
  }
}

/** Documents in the category fall back to uncategorized ("Overig") via the
 * onDelete: SetNull relation — nothing else to clean up. */
export async function deleteDocCategory(id: number) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const result = await prisma.docCategory.deleteMany({ where: { id, householdId } });
    if (result.count === 0) {
      throw new Error("Categorie niet gevonden");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to delete doc category:", error);
    throw new Error("Verwijderen categorie mislukt");
  } finally {
    revalidatePath("/docs");
  }
}

/** Keyed on (householdId, label) — editing an existing label just updates its
 * value; a new label creates a new row. */
export async function upsertKeyInfo(label: string, value: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validLabel = labelSchema.parse(label);
    const validValue = valueSchema.parse(value);

    await prisma.keyInfo.upsert({
      where: { householdId_label: { householdId, label: validLabel } },
      create: { householdId, label: validLabel, value: validValue },
      update: { value: validValue },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to upsert key info:", error);
    throw new Error("Opslaan mislukt");
  } finally {
    revalidatePath("/docs");
  }
}

export async function deleteKeyInfo(id: number) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const result = await prisma.keyInfo.deleteMany({ where: { id, householdId } });
    if (result.count === 0) {
      throw new Error("Info niet gevonden");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to delete key info:", error);
    throw new Error("Verwijderen mislukt");
  } finally {
    revalidatePath("/docs");
  }
}
