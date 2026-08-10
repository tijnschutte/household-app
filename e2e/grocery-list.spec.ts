import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The two gestures on the list that only exist in a laid-out, hydrated browser.
 *
 * Neither is reachable from `bun run verify`. The category picker is a
 * positioning bug: happy-dom has no layout, so a menu rendered 500px above the
 * viewport measures the same as one under the trigger. Dragging is a hydration
 * bug: RTL mounts straight onto the client, so the first-render state that
 * broke it never happens there. Both need a real request to a real build, which
 * is what this file is.
 *
 * Prisma appears here twice: to remove the account afterwards, and to create
 * the category the drag test drags into. Arranging that through the picker
 * would make one spec fail whenever the other feature broke.
 */

const prisma = new PrismaClient();

// Usernames are unique and capped at 15 characters. Each test founds its own
// household, so they share a prefix for cleanup and nothing else.
const stamp = Date.now().toString().slice(-9);
const prefix = `e2ec${stamp}`;
const password = "password";

const addBarOf = (page: Page) => page.getByPlaceholder("Voeg een item toe...");
const addButtonOf = (page: Page) =>
  page.locator("footer").getByRole("button", { name: "Item toevoegen" });
const pickerOf = (page: Page) => page.getByLabel("Categorie voor nieuwe items");

async function signUpAndFoundHousehold(page: Page, suffix: string) {
  const name = `${prefix}${suffix}`;
  await page.goto("/sign-up");
  await page.getByLabel("Gebruikersnaam").fill(name);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Registreren" }).click();
  await page.waitForURL(/household-setup/, { timeout: 30_000 });

  await page.getByLabel("Huishoudnaam").fill(`Huis ${prefix}${suffix}`);
  await page.getByRole("button", { name: "Huishouden aanmaken" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
  await expect(addBarOf(page)).toBeVisible({ timeout: 30_000 });

  return prisma.user.findFirstOrThrow({ where: { name } });
}

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { name: { startsWith: prefix } } });
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

test("the category picker opens on screen, and can reach the create-category dialog", async ({
  page,
}) => {
  // A short phone, not the config's roomier default: the menu only lands
  // off-screen when it wants more height than sits above the add bar, so a tall
  // viewport hides the bug entirely.
  await page.setViewportSize({ width: 390, height: 664 });

  const user = await signUpAndFoundHousehold(page, "p");
  // Enough categories that the menu wants more height than the screen has —
  // that is the condition being tested, not an incidental detail of an account.
  // A handful of them still fits, and would pass whether or not it is clamped.
  await prisma.category.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      name: `Categorie ${String(i + 1).padStart(2, "0")}`,
      householdId: user.householdId,
      userId: null,
    })),
  });
  await page.reload();
  await expect(addBarOf(page)).toBeVisible({ timeout: 30_000 });

  await pickerOf(page).click();

  // The menu is the only route to creating a category, so "rendered somewhere"
  // is not enough — it has to be somewhere the thumb can reach.
  const menu = page.locator("[data-slot=select-content]").first();
  await expect(menu).toBeVisible();

  const box = await menu.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

  await page.getByRole("option", { name: /Nieuwe categorie/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("an item can be dragged into a category on a freshly loaded page", async ({ page }) => {
  const user = await signUpAndFoundHousehold(page, "d");
  expect(user.householdId).not.toBeNull();

  // The category needs a row of its own to be a visible drop target, so it is
  // arranged with one rather than left empty.
  const zuivel = await prisma.category.create({
    data: { name: "Zuivel", householdId: user.householdId, userId: null },
  });
  await prisma.grocery.create({
    data: { name: "kaas", householdId: user.householdId, userId: null, categoryId: zuivel.id },
  });

  await addBarOf(page).fill("melk");
  await addButtonOf(page).click();
  await expect(page.getByText("Melk")).toBeVisible();

  // The bug only exists on a first paint: any later re-render repaired it, so
  // a spec that navigated around first would pass against the broken build.
  await page.reload();
  await expect(page.getByText("Melk")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Zuivel")).toBeVisible();

  // The handle belonging to Melk specifically — `.first()` would pick whichever
  // row the grouping happens to render first, which is not what this drags.
  const handle = page
    .getByRole("button", { name: "melk hernoemen" })
    .locator("xpath=following-sibling::*[@data-drag-handle]");
  const target = page.getByText("Zuivel");
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;
  const endX = to!.x + to!.width / 2;
  const endY = to!.y + to!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Past the sensor's 8px activation distance, in steps: one big jump reads as
  // a teleport and never crosses the threshold on the way.
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(
      startX + (endX - startX) * (step / 12),
      startY + (endY - startY) * (step / 12)
    );
    await page.waitForTimeout(40);
  }
  // Separates "the gesture never armed the sensor" from "the drop landed in the
  // wrong place" when this fails.
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.mouse.up();

  // The real outcome: reloading shows the item filed under the category.
  await page.reload();
  await expect(page.getByText("Melk")).toBeVisible({ timeout: 30_000 });
  // A row on the shared list is filed against the household, with userId null.
  const melk = await prisma.grocery.findFirstOrThrow({
    where: { name: "melk", householdId: user.householdId },
  });
  expect(melk.categoryId).toBe(zuivel.id);
});
