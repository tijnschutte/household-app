import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { getStorage } from "@/src/lib/storage";
import { EXTENSION_BY_CONTENT_TYPE } from "@/src/lib/docs/constants";

// Strips characters that would break (or inject headers into) the
// Content-Disposition value, and caps length.
function sanitizeFilename(name: string, contentType: string): string {
  const base =
    name
      .replace(/["\r\n\\]/g, "")
      .trim()
      .slice(0, 80) || "document";
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) {
    return `${base}.${ext}`;
  }
  return base;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let householdId: number | null;
  try {
    ({ householdId } = await requireUser());
  } catch {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  if (!householdId) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  // Scoped to the caller's household — a document belonging to another
  // household 404s exactly like one that doesn't exist.
  const doc = await prisma.document.findFirst({ where: { id, householdId } });
  if (!doc) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const stored = await getStorage().get(doc.storageKey);
  if (!stored) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const filename = sanitizeFilename(doc.name, doc.contentType);

  return new NextResponse(stored.body as BodyInit, {
    headers: {
      "Content-Type": stored.contentType ?? doc.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(doc.sizeBytes),
      "Cache-Control": "private, no-store",
      // The stored contentType is client-declared at upload (allowlisted, but
      // the bytes aren't verified) — never let the browser sniff past it.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
