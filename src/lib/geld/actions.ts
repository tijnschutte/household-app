"use server";

import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";
import { MONTH_RE } from "@/src/lib/geld/money";
import { Prisma, RecurringKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const monthSchema = z.string().regex(MONTH_RE, "Ongeldige maand");
const amountCentsSchema = z
  .number()
  .int("Bedrag moet een geheel getal zijn")
  .positive("Bedrag moet groter dan nul zijn")
  .max(10_000_000, "Bedrag is te hoog");
const nameSchema = z
  .string()
  .trim()
  .min(1, "Naam is vereist")
  .max(40, "Naam mag maximaal 40 karakters zijn");

// Verifies the recurring item belongs to the caller's household. Every
// mutation that touches a RecurringItem (or something scoped through one)
// starts here, never trusting a client-supplied id on its own.
async function requireOwnedItem(id: number, householdId: number) {
  const item = await prisma.recurringItem.findFirst({ where: { id, householdId } });
  if (!item) {
    throw new Error("Item niet gevonden");
  }
  return item;
}

function isActiveInMonth(item: { activeFrom: string; activeTo: string | null }, month: string) {
  return item.activeFrom <= month && (item.activeTo == null || item.activeTo >= month);
}

/** Marking paid IS the domain action — there's no separate "paid" flag. */
export async function markPaid(recurringItemId: number, month: string, amountCents: number) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validMonth = monthSchema.parse(month);
    const validAmount = amountCentsSchema.parse(amountCents);

    const item = await requireOwnedItem(recurringItemId, householdId);
    if (!isActiveInMonth(item, validMonth)) {
      throw new Error("Item is niet actief in deze maand");
    }

    await prisma.monthEntry.create({
      data: { recurringItemId, month: validMonth, amountCents: validAmount },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Al betaald");
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to mark paid:", error);
    throw new Error("Markeren als betaald mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function undoPaid(recurringItemId: number, month: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validMonth = monthSchema.parse(month);
    await requireOwnedItem(recurringItemId, householdId);

    const result = await prisma.monthEntry.deleteMany({
      where: { recurringItemId, month: validMonth },
    });
    if (result.count === 0) {
      throw new Error("Betaling niet gevonden");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to undo paid:", error);
    throw new Error("Ongedaan maken mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function createRecurringItem(
  name: string,
  kind: RecurringKind,
  expectedCents: number,
  activeFrom: string
) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validName = nameSchema.parse(name);
    const validExpected = amountCentsSchema.parse(expectedCents);
    const validActiveFrom = monthSchema.parse(activeFrom);

    return await prisma.recurringItem.create({
      data: {
        householdId,
        name: validName,
        kind,
        expectedCents: validExpected,
        activeFrom: validActiveFrom,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Bestaat al");
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to create recurring item:", error);
    throw new Error("Aanmaken mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function updateRecurringItem(
  id: number,
  updates: { name?: string; expectedCents?: number }
) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const data: { name?: string; expectedCents?: number } = {};
    if (updates.name !== undefined) {
      data.name = nameSchema.parse(updates.name);
    }
    if (updates.expectedCents !== undefined) {
      data.expectedCents = amountCentsSchema.parse(updates.expectedCents);
    }
    if (Object.keys(data).length === 0) return;

    const result = await prisma.recurringItem.updateMany({
      where: { id, householdId },
      data,
    });
    if (result.count === 0) {
      throw new Error("Item niet gevonden");
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Bestaat al");
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to update recurring item:", error);
    throw new Error("Bijwerken mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function endRecurringItem(id: number, lastMonth: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validLastMonth = monthSchema.parse(lastMonth);
    const item = await requireOwnedItem(id, householdId);
    if (validLastMonth < item.activeFrom) {
      throw new Error("Laatste maand ligt voor de startmaand");
    }

    await prisma.recurringItem.update({
      where: { id },
      data: { activeTo: validLastMonth },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to end recurring item:", error);
    throw new Error("Beëindigen mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function deleteRecurringItem(id: number) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const item = await prisma.recurringItem.findFirst({
      where: { id, householdId },
      include: { _count: { select: { entries: true } } },
    });
    if (!item) {
      throw new Error("Item niet gevonden");
    }
    if (item._count.entries > 0) {
      throw new Error("Item is al gebruikt — beëindig het in plaats van verwijderen");
    }

    await prisma.recurringItem.deleteMany({ where: { id, householdId } });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to delete recurring item:", error);
    throw new Error("Verwijderen mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function addAdjustment(month: string, amountCents: number, note?: string) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const validMonth = monthSchema.parse(month);
    const validAmount = z
      .number()
      .int("Bedrag moet een geheel getal zijn")
      .refine((val) => val !== 0, "Bedrag mag niet nul zijn")
      .refine((val) => Math.abs(val) <= 10_000_000, "Bedrag is te hoog")
      .parse(amountCents);
    const trimmedNote = note?.trim();

    await prisma.adjustment.create({
      data: {
        householdId,
        month: validMonth,
        amountCents: validAmount,
        note: trimmedNote ? trimmedNote.slice(0, 100) : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.errors[0].message);
    }
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to add adjustment:", error);
    throw new Error("Toevoegen correctie mislukt");
  } finally {
    revalidatePath("/geld");
  }
}

export async function deleteAdjustment(id: number) {
  try {
    const { householdId } = await requireUser();
    if (!householdId) throw new Error("Je bent niet lid van een huishouden");

    const result = await prisma.adjustment.deleteMany({ where: { id, householdId } });
    if (result.count === 0) {
      throw new Error("Correctie niet gevonden");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error("Failed to delete adjustment:", error);
    throw new Error("Verwijderen correctie mislukt");
  } finally {
    revalidatePath("/geld");
  }
}
