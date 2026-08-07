import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The home screen, requested from a running server.
 *
 * This exists because the unit tests cannot render an async Server Component,
 * and page.tsx holds two things they therefore cannot guard:
 *
 *  - the props handed to the client must be server actions. When one became a
 *    plain closure the whole tree failed to serialize and /home never got past
 *    its loading skeleton, with every gate still green. "The add bar is on
 *    screen" is the assertion that catches it.
 *  - the ViewKey -> `personal` translation must not be inverted. One account
 *    cannot detect that: both lists swap together and everything still looks
 *    symmetric. It takes a housemate, which is why the second account below
 *    joins the household and looks for the shared item.
 *
 * Prisma appears here only to remove the accounts afterwards. Every assertion
 * goes through the UI; nothing is seeded, so the spec depends on a migrated
 * database and nothing else.
 */

const prisma = new PrismaClient();

// Usernames are unique and capped at 15 characters.
const stamp = Date.now().toString().slice(-9);
const owner = `e2ea${stamp}`;
const housemate = `e2eb${stamp}`;
const password = "password";

async function signUp(page: Page, name: string) {
  // Signing up signs you in and drops you on household setup.
  await page.goto("/sign-up");
  await page.getByLabel("Gebruikersnaam").fill(name);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Registreren" }).click();
  await page.waitForURL(/household-setup/, { timeout: 30_000 });
}

const addBarOf = (page: Page) => page.getByPlaceholder("Voeg een item toe...");
const addButtonOf = (page: Page) =>
  page.locator("footer").getByRole("button", { name: "Item toevoegen" });

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { name: { in: [owner, housemate] } } });
  const householdIds = users.flatMap((u) => (u.householdId ? [u.householdId] : []));
  const scope = {
    OR: [{ userId: { in: users.map((u) => u.id) } }, { householdId: { in: householdIds } }],
  };
  await prisma.grocery.deleteMany({ where: scope });
  await prisma.category.deleteMany({ where: scope });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
  await prisma.$disconnect();
});

test("the home screen renders, and a housemate sees the shared list but not the personal one", async ({
  page,
  browser,
}) => {
  await signUp(page, owner);
  await page.getByLabel("Huishoudnaam").fill(`Huis ${stamp}`);
  await page.getByRole("button", { name: "Huishouden aanmaken" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });

  // The one that fails when a prop cannot be serialized: nothing below the
  // loading skeleton ever arrives.
  await expect(addBarOf(page)).toBeVisible({ timeout: 30_000 });

  await addBarOf(page).fill("brood");
  await addButtonOf(page).click();
  await expect(page.getByText("Brood")).toBeVisible();

  // Reloading proves the item was written and read back, rather than only
  // living in the optimistic client state.
  await page.reload();
  await expect(page.getByText("Brood")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("tab", { name: "Persoonlijk" }).click();
  await expect(page.getByText("Brood")).toBeHidden();
  await addBarOf(page).fill("dagboek");
  await addButtonOf(page).click();
  await expect(page.getByText("Dagboek")).toBeVisible();

  // --- a second member of the same household ---------------------------
  await page.goto("/huis");
  const joinCode = await page.getByLabel("Huishoudcode").inputValue();
  expect(joinCode).not.toBe("N/A");

  const secondDevice = await browser.newContext();
  const housematePage = await secondDevice.newPage();
  await signUp(housematePage, housemate);
  await housematePage.getByRole("tab", { name: "Deelnemen" }).click();
  await housematePage.getByLabel("Huishoudcode").fill(joinCode);
  await housematePage.getByRole("button", { name: "Deelnemen" }).last().click();
  await housematePage.waitForURL(/\/home/, { timeout: 30_000 });

  await expect(addBarOf(housematePage)).toBeVisible({ timeout: 30_000 });
  // Shared means shared: the housemate sees the household item...
  await expect(housematePage.getByText("Brood")).toBeVisible();
  // ...and personal means personal.
  await expect(housematePage.getByText("Dagboek")).toBeHidden();

  await secondDevice.close();
});
