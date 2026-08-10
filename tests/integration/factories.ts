/**
 * Rows for an integration test to act on, written straight to the database.
 *
 * Deliberately not through the server actions: a test that arranges its
 * fixtures with the code it is about to test can only prove that code agrees
 * with itself. These write what the schema allows, and the action under test
 * has to prove it respects it.
 */

import db from "@/src/lib/db/db";
import type { Category, Grocery, Household, RecurringItem, User } from "@prisma/client";
import { RecurringKind } from "@prisma/client";

/** A household and the one member most scoping tests need it to have. */
export async function aHouseholdWith(
  memberName: string,
  householdName = `${memberName}-huis`
): Promise<{ household: Household; member: User }> {
  const household = await db.household.create({
    data: {
      name: householdName,
      secret: householdName.toUpperCase().slice(0, 12),
      members: { create: { name: memberName, password: "hashed" } },
    },
    include: { members: true },
  });

  return { household, member: household.members[0] };
}

/** Somebody signed in who has not joined a household yet. */
export async function aLoneUser(name: string): Promise<User> {
  return db.user.create({ data: { name, password: "hashed" } });
}

/**
 * An item on a list. Exactly one owner: a household's shared list, or one
 * person's private one — the schema allows both columns to be set at once, and
 * the scoping rules assume they never are.
 */
export function aGrocery(
  owner: { householdId: number } | { userId: number },
  attributes: { name: string; categoryId?: number | null; bought?: boolean }
): Promise<Grocery> {
  return db.grocery.create({
    data: {
      name: attributes.name,
      categoryId: attributes.categoryId ?? null,
      bought: attributes.bought ?? false,
      householdId: "householdId" in owner ? owner.householdId : null,
      userId: "userId" in owner ? owner.userId : null,
    },
  });
}

export function aCategory(
  owner: { householdId: number } | { userId: number },
  name: string
): Promise<Category> {
  return db.category.create({
    data: {
      name,
      householdId: "householdId" in owner ? owner.householdId : null,
      userId: "userId" in owner ? owner.userId : null,
    },
  });
}

export function aRecurringItem(
  householdId: number,
  attributes: {
    name: string;
    kind?: RecurringKind;
    expectedCents?: number;
    activeFrom?: string;
    activeTo?: string | null;
  }
): Promise<RecurringItem> {
  return db.recurringItem.create({
    data: {
      householdId,
      name: attributes.name,
      kind: attributes.kind ?? RecurringKind.CONTRIBUTION,
      expectedCents: attributes.expectedCents ?? 10_000,
      activeFrom: attributes.activeFrom ?? "2026-01",
      activeTo: attributes.activeTo ?? null,
    },
  });
}
