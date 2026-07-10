import { PrismaClient, RecurringKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// The household's real recurring pot items (WP-Geld), so dev data matches
// production intent. Kept idempotent via the RecurringItem
// (householdId, name, kind) unique constraint.
const RECURRING_ITEMS: {
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
}[] = [
  { name: "Tijn", kind: RecurringKind.CONTRIBUTION, expectedCents: 107055, activeFrom: "2026-06" },
  { name: "Dirk", kind: RecurringKind.CONTRIBUTION, expectedCents: 179111, activeFrom: "2026-06" },
  {
    name: "Vastgoedunie",
    kind: RecurringKind.EXPENSE,
    expectedCents: 256972,
    activeFrom: "2026-06",
  },
  { name: "Ziggo", kind: RecurringKind.EXPENSE, expectedCents: 8700, activeFrom: "2026-06" },
  { name: "Essent", kind: RecurringKind.EXPENSE, expectedCents: 12900, activeFrom: "2026-06" },
  { name: "Meo Lease", kind: RecurringKind.EXPENSE, expectedCents: 3795, activeFrom: "2026-06" },
  { name: "Waternet", kind: RecurringKind.EXPENSE, expectedCents: 2800, activeFrom: "2026-06" },
  { name: "Netflix", kind: RecurringKind.EXPENSE, expectedCents: 999, activeFrom: "2026-06" },
];

export async function main() {
  const password = await bcrypt.hash("password", 10);
  const user = await prisma.user.upsert({
    where: { name: "Tijn" },
    update: {},
    create: {
      name: "Tijn",
      password,
      household: {
        create: {
          name: "CD26",
          secret: "LOCALDEV1234",
        },
      },
    },
    include: { household: true },
  });

  const householdId = user.householdId;
  if (householdId) {
    for (const item of RECURRING_ITEMS) {
      await prisma.recurringItem.upsert({
        where: {
          householdId_name_kind: { householdId, name: item.name, kind: item.kind },
        },
        update: {},
        create: { householdId, ...item },
      });
    }
  }

  console.log('Seeded: user "Tijn" (password "password"), household "CD26" (code LOCALDEV1234)');
  console.log(`Seeded: ${RECURRING_ITEMS.length} recurring Geld items for household "CD26"`);
}

main();
