import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { getStorage } from "@/src/lib/storage";
import { MAX_UPLOAD_BYTES, isAllowedContentType } from "@/src/lib/docs/constants";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Naam is vereist")
  .max(60, "Naam mag maximaal 60 karakters zijn");

export async function POST(request: NextRequest) {
  let userId: number;
  let householdId: number | null;
  try {
    ({ userId, householdId } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  if (!householdId) {
    return NextResponse.json({ error: "Je bent niet lid van een huishouden" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
  }

  const nameRaw = formData.get("name");
  const parsedName = nameSchema.safeParse(
    typeof nameRaw === "string" && nameRaw ? nameRaw : file.name
  );
  if (!parsedName.success) {
    return NextResponse.json({ error: parsedName.error.errors[0].message }, { status: 400 });
  }

  // Optional user-created category; must belong to the caller's household.
  // Absent/empty = uncategorized ("Overig").
  const categoryIdRaw = formData.get("categoryId");
  let categoryId: number | null = null;
  if (typeof categoryIdRaw === "string" && categoryIdRaw !== "") {
    const parsed = Number(categoryIdRaw);
    if (!Number.isInteger(parsed)) {
      return NextResponse.json({ error: "Categorie niet gevonden" }, { status: 400 });
    }
    const category = await prisma.docCategory.findFirst({
      where: { id: parsed, householdId },
    });
    if (!category) {
      return NextResponse.json({ error: "Categorie niet gevonden" }, { status: 400 });
    }
    categoryId = category.id;
  }

  if (!isAllowedContentType(file.type)) {
    return NextResponse.json({ error: "Bestandstype niet toegestaan" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Bestand is te groot (max 4MB)" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Bestand is leeg" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `${householdId}/${randomUUID()}`;

  try {
    await getStorage().put(storageKey, buffer, file.type);
  } catch (error) {
    console.error("Failed to store uploaded file:", error);
    return NextResponse.json({ error: "Uploaden mislukt" }, { status: 500 });
  }

  try {
    const doc = await prisma.document.create({
      data: {
        householdId,
        name: parsedName.data,
        categoryId,
        storageKey,
        contentType: file.type,
        sizeBytes: file.size,
        uploadedById: userId,
      },
      select: { id: true },
    });
    revalidatePath("/docs");
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save document row, cleaning up stored file:", error);
    try {
      await getStorage().delete(storageKey);
    } catch (cleanupError) {
      console.error("Failed to clean up orphaned stored file:", storageKey, cleanupError);
    }
    return NextResponse.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
