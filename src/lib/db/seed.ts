import { PrismaClient, RecurringKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HOUSEHOLD = { name: "CD26", secret: "LOCALDEV1234" };
const MEMBERS = ["Tijn", "Dirk"];
const PASSWORD = "password";

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

// Half the month's lines are paid, so the Geld overview opens on a
// part-finished month instead of an empty one. "expected" pays the exact
// amount; a number pays something else, to exercise the deviation display.
const PAID_THIS_MONTH: Record<string, number | "expected"> = {
  Tijn: "expected",
  Vastgoedunie: "expected",
  Ziggo: 9200,
  Netflix: "expected",
};

const ADJUSTMENT = { amountCents: 2500, note: "Te veel betaald aan Essent, teruggestort" };

type ListSection = {
  category: string;
  items: { name: string; quantity?: number; bought?: boolean }[];
};

const SHARED_LIST: ListSection[] = [
  {
    category: "Groente & Fruit",
    items: [
      { name: "Bananen", quantity: 6 },
      { name: "Avocado", quantity: 2, bought: true },
      { name: "Spinazie" },
      { name: "Cherrytomaten" },
    ],
  },
  {
    category: "Zuivel",
    items: [
      { name: "Halfvolle melk", quantity: 2 },
      { name: "Griekse yoghurt" },
      { name: "Jonge kaas", bought: true },
    ],
  },
  {
    category: "Borrel",
    items: [{ name: "Chips paprika", quantity: 2 }, { name: "Olijven" }],
  },
  {
    category: "Huishouden",
    items: [{ name: "Vaatwastabletten" }, { name: "Keukenpapier", quantity: 2 }],
  },
];

const PERSONAL_LIST: ListSection[] = [
  {
    category: "Werk",
    items: [{ name: "Notitieboekje" }, { name: "Koffiebonen" }],
  },
  {
    category: "Sport",
    items: [{ name: "Eiwitpoeder" }, { name: "Bidon", bought: true }],
  },
];

// Categories and groceries are scoped either to a household (the shared list)
// or to a user (the personal list); the owner column decides which.
type ListOwner = { householdId: number } | { userId: number };

const ownedBy = (name: string, owner: ListOwner) =>
  "householdId" in owner
    ? { name_householdId: { name, householdId: owner.householdId } }
    : { name_userId: { name, userId: owner.userId } };

async function seedHousehold() {
  const household = await prisma.household.upsert({
    where: { name: HOUSEHOLD.name },
    update: {},
    create: HOUSEHOLD,
  });

  const password = await bcrypt.hash(PASSWORD, 10);
  const members = await Promise.all(
    MEMBERS.map((name) =>
      prisma.user.upsert({
        where: { name },
        update: { householdId: household.id },
        create: { name, password, householdId: household.id },
      })
    )
  );

  return { household, members };
}

async function seedList(sections: ListSection[], owner: ListOwner) {
  for (const section of sections) {
    const category = await prisma.category.upsert({
      where: ownedBy(section.category, owner),
      update: {},
      create: { name: section.category, ...owner },
    });

    for (const item of section.items) {
      await prisma.grocery.upsert({
        where: ownedBy(item.name, owner),
        update: {},
        create: { ...item, categoryId: category.id, ...owner },
      });
    }
  }
}

async function seedGeld(householdId: number, month: string) {
  for (const item of RECURRING_ITEMS) {
    const recurringItem = await prisma.recurringItem.upsert({
      where: { householdId_name_kind: { householdId, name: item.name, kind: item.kind } },
      update: {},
      create: { householdId, ...item },
    });

    const paid = PAID_THIS_MONTH[item.name];
    if (paid === undefined) continue;

    await prisma.monthEntry.upsert({
      where: { recurringItemId_month: { recurringItemId: recurringItem.id, month } },
      update: {},
      create: {
        recurringItemId: recurringItem.id,
        month,
        amountCents: paid === "expected" ? item.expectedCents : paid,
      },
    });
  }

  // Adjustments carry no natural key, so re-seeding would stack duplicates.
  const existing = await prisma.adjustment.findFirst({ where: { householdId, month } });
  if (!existing) {
    await prisma.adjustment.create({ data: { householdId, month, ...ADJUSTMENT } });
  }
}

async function main() {
  const month = new Date().toISOString().slice(0, 7);
  const { household, members } = await seedHousehold();

  await seedList(SHARED_LIST, { householdId: household.id });
  await seedList(PERSONAL_LIST, { userId: members[0].id });
  await seedGeld(household.id, month);

  const sharedItems = SHARED_LIST.reduce((total, s) => total + s.items.length, 0);
  console.log(`Seeded: household "${household.name}" (join code ${household.secret})`);
  console.log(`Seeded: users ${MEMBERS.join(", ")} — all with password "${PASSWORD}"`);
  console.log(
    `Seeded: ${sharedItems} shared groceries in ${SHARED_LIST.length} categories, ` +
      `plus a personal list for ${MEMBERS[0]}`
  );
  console.log(`Seeded: ${RECURRING_ITEMS.length} recurring Geld items, part-paid for ${month}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
