import { PrismaClient, RecurringKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * A made-up household to develop against. Nothing here is anyone's real data:
 * the names are placeholders and the amounts are picked to exercise the
 * display — one four-figure sum for the thousands separator, one with cents,
 * and one line paid for something other than the expected amount.
 */
const HOUSEHOLD = { name: "Testhuishouden", secret: "LOCALDEV1234" };
const PASSWORD = "password";

// Each member also contributes to the pot, so their contribution is derived
// from this list rather than repeated in it — renaming a member here renames
// the line they pay.
const MEMBERS = [
  { name: "Sam", contributionCents: 75000 },
  { name: "Robin", contributionCents: 70000 },
];

// Generic running costs rather than named suppliers. Together they come to
// slightly less than the two contributions, so the month opens with a small
// surplus instead of a suspiciously exact zero.
const EXPENSES = [
  { name: "Huur", expectedCents: 120000 },
  { name: "Energie", expectedCents: 14500 },
  { name: "Internet", expectedCents: 4500 },
  { name: "Water", expectedCents: 2000 },
  { name: "Streamingdienst", expectedCents: 1099 },
];

/**
 * The month an item started running. Derived rather than hardcoded so the
 * seed stays valid whenever it is run: an item must already be active in the
 * month we mark it paid for, which a fixed date stops guaranteeing the moment
 * the calendar moves past it.
 */
function monthsAgo(count: number) {
  const now = new Date();
  // Day 1 avoids the month-end overflow that turns "31 August minus 2" into September.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1))
    .toISOString()
    .slice(0, 7);
}

const ACTIVE_FROM = monthsAgo(2);

// Kept idempotent via the RecurringItem (householdId, name, kind) unique constraint.
const RECURRING_ITEMS: {
  name: string;
  kind: RecurringKind;
  expectedCents: number;
  activeFrom: string;
}[] = [
  ...MEMBERS.map(({ name, contributionCents }) => ({
    name,
    kind: RecurringKind.CONTRIBUTION,
    expectedCents: contributionCents,
    activeFrom: ACTIVE_FROM,
  })),
  ...EXPENSES.map((expense) => ({
    ...expense,
    kind: RecurringKind.EXPENSE,
    activeFrom: ACTIVE_FROM,
  })),
];

// Half the month's lines are paid, so the Geld overview opens on a
// part-finished month instead of an empty one. "expected" pays the exact
// amount; a number pays something else, to exercise the deviation display.
const PAID_THIS_MONTH: Record<string, number | "expected"> = {
  [MEMBERS[0].name]: "expected",
  Huur: "expected",
  Internet: 4750,
  Streamingdienst: "expected",
};

const ADJUSTMENT = { amountCents: 2500, note: "Te veel betaald aan Energie, teruggestort" };

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
  // Keyed on the join code, not the name: the code is the one thing about this
  // fixture that never changes, so renaming the household still re-seeds onto
  // the same row instead of colliding with it on the unique `secret`.
  const household = await prisma.household.upsert({
    where: { secret: HOUSEHOLD.secret },
    update: { name: HOUSEHOLD.name },
    create: HOUSEHOLD,
  });

  const password = await bcrypt.hash(PASSWORD, 10);
  const members = await Promise.all(
    MEMBERS.map(({ name }) =>
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
  const month = monthsAgo(0);
  const { household, members } = await seedHousehold();

  await seedList(SHARED_LIST, { householdId: household.id });
  await seedList(PERSONAL_LIST, { userId: members[0].id });
  await seedGeld(household.id, month);

  const sharedItems = SHARED_LIST.reduce((total, s) => total + s.items.length, 0);
  console.log(`Seeded: household "${household.name}" (join code ${household.secret})`);
  console.log(
    `Seeded: users ${MEMBERS.map((m) => m.name).join(", ")} — all with password "${PASSWORD}"`
  );
  console.log(
    `Seeded: ${sharedItems} shared groceries in ${SHARED_LIST.length} categories, ` +
      `plus a personal list for ${MEMBERS[0].name}`
  );
  console.log(`Seeded: ${RECURRING_ITEMS.length} recurring Geld items, part-paid for ${month}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
