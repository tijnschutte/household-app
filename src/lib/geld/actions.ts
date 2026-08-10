"use server";

import prisma from "@/src/lib/db/db";
import { requireHousehold } from "@/src/lib/session";
import { executeAction } from "@/src/lib/executeAction";
import { DomainError } from "@/src/lib/domain-error";
import { rejectingDuplicates } from "@/src/lib/db/duplicates";
import { MONTH_RE } from "@/src/lib/geld/money";
import { RecurringKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const monthSchema = z.string().regex(MONTH_RE, "Ongeldige maand");
const amountCentsSchema = z
  .number()
  .int("Bedrag moet een geheel getal zijn")
  .positive("Bedrag moet groter dan nul zijn")
  .max(10_000_000, "Bedrag is te hoog");
// A correction moves the total either way, so unlike an amount it may be
// negative — but a correction of nothing is not a correction.
const adjustmentCentsSchema = z
  .number()
  .int("Bedrag moet een geheel getal zijn")
  .refine((val) => val !== 0, "Bedrag mag niet nul zijn")
  .refine((val) => Math.abs(val) <= 10_000_000, "Bedrag is te hoog");
const nameSchema = z
  .string()
  .trim()
  .min(1, "Naam is vereist")
  .max(40, "Naam mag maximaal 40 karakters zijn");

/**
 * Every mutation on this page reports its outcome the same way and invalidates
 * the same route, so it is said once here.
 *
 * Only a write that happened is worth revalidating: a rejected one changed
 * nothing, and the screen keeps its dialog open to show why. No success message
 * is passed because no geld screen renders one — each writes its own line
 * naming the item, which this layer cannot phrase as well.
 */
async function geldMutation<T>(actionFn: () => Promise<T>) {
  const result = await executeAction({ actionFn });
  if (result.success) {
    revalidatePath("/geld");
  }
  return result;
}

// Verifies the recurring item belongs to the caller's household. Every
// mutation that touches a RecurringItem (or something scoped through one)
// starts here, never trusting a client-supplied id on its own.
async function requireOwnedItem(id: number, householdId: number) {
  const item = await prisma.recurringItem.findFirst({ where: { id, householdId } });
  if (!item) {
    throw new DomainError("Item niet gevonden");
  }
  return item;
}

function isActiveInMonth(item: { activeFrom: string; activeTo: string | null }, month: string) {
  return item.activeFrom <= month && (item.activeTo == null || item.activeTo >= month);
}

/** Marking paid IS the domain action — there's no separate "paid" flag. */
export async function markPaid(recurringItemId: number, month: string, amountCents: number) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const validMonth = monthSchema.parse(month);
    const validAmount = amountCentsSchema.parse(amountCents);

    const item = await requireOwnedItem(recurringItemId, householdId);
    if (!isActiveInMonth(item, validMonth)) {
      throw new DomainError("Item is niet actief in deze maand");
    }

    await rejectingDuplicates(
      () =>
        prisma.monthEntry.create({
          data: { recurringItemId, month: validMonth, amountCents: validAmount },
        }),
      "Al betaald"
    );
  });
}

export async function undoPaid(recurringItemId: number, month: string) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const validMonth = monthSchema.parse(month);
    await requireOwnedItem(recurringItemId, householdId);

    const result = await prisma.monthEntry.deleteMany({
      where: { recurringItemId, month: validMonth },
    });
    if (result.count === 0) {
      throw new DomainError("Betaling niet gevonden");
    }
  });
}

export async function createRecurringItem(
  name: string,
  kind: RecurringKind,
  expectedCents: number,
  activeFrom: string
) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const validName = nameSchema.parse(name);
    const validExpected = amountCentsSchema.parse(expectedCents);
    const validActiveFrom = monthSchema.parse(activeFrom);

    return rejectingDuplicates(
      () =>
        prisma.recurringItem.create({
          data: {
            householdId,
            name: validName,
            kind,
            expectedCents: validExpected,
            activeFrom: validActiveFrom,
          },
        }),
      "Bestaat al"
    );
  });
}

export async function updateRecurringItem(
  id: number,
  updates: { name?: string; expectedCents?: number }
) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const data: { name?: string; expectedCents?: number } = {};
    if (updates.name !== undefined) {
      data.name = nameSchema.parse(updates.name);
    }
    if (updates.expectedCents !== undefined) {
      data.expectedCents = amountCentsSchema.parse(updates.expectedCents);
    }
    if (Object.keys(data).length === 0) return;

    const result = await rejectingDuplicates(
      () => prisma.recurringItem.updateMany({ where: { id, householdId }, data }),
      "Bestaat al"
    );
    if (result.count === 0) {
      throw new DomainError("Item niet gevonden");
    }
  });
}

export async function endRecurringItem(id: number, lastMonth: string) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const validLastMonth = monthSchema.parse(lastMonth);
    const item = await requireOwnedItem(id, householdId);
    if (validLastMonth < item.activeFrom) {
      throw new DomainError("Laatste maand ligt voor de startmaand");
    }

    await prisma.recurringItem.update({
      where: { id },
      data: { activeTo: validLastMonth },
    });
  });
}

export async function deleteRecurringItem(id: number) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    // The entry count comes back with the item, because whether it may be
    // deleted at all depends on it.
    const item = await prisma.recurringItem.findFirst({
      where: { id, householdId },
      include: { _count: { select: { entries: true } } },
    });
    if (!item) {
      throw new DomainError("Item niet gevonden");
    }
    if (item._count.entries > 0) {
      throw new DomainError("Item is al gebruikt — beëindig het in plaats van verwijderen");
    }

    await prisma.recurringItem.deleteMany({ where: { id, householdId } });
  });
}

export async function addAdjustment(month: string, amountCents: number, note?: string) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const validMonth = monthSchema.parse(month);
    const validAmount = adjustmentCentsSchema.parse(amountCents);
    const trimmedNote = note?.trim();

    await prisma.adjustment.create({
      data: {
        householdId,
        month: validMonth,
        amountCents: validAmount,
        note: trimmedNote ? trimmedNote.slice(0, 100) : null,
      },
    });
  });
}

export async function deleteAdjustment(id: number) {
  return geldMutation(async () => {
    const { householdId } = await requireHousehold();

    const result = await prisma.adjustment.deleteMany({ where: { id, householdId } });
    if (result.count === 0) {
      throw new DomainError("Correctie niet gevonden");
    }
  });
}
