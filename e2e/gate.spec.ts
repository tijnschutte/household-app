import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The gate a session outlives its own user.
 *
 * `db:reset` (or any deletion of a user row) leaves a signed-in browser
 * holding a JWT for an id that no longer exists in the database. That is not
 * a hypothetical: it is exactly what happens between two `bun run dev:fresh`
 * runs if the cookie survives. requireMembership -> requireSignedIn only ever
 * checked the JWT, so getCurrentHousehold's own requireUser() call was the
 * first thing to notice the user was gone, and it noticed by throwing —
 * which crashed the page instead of sending the visitor back to /sign-in.
 *
 * This spec deletes the row directly (rather than running `db:reset`, which
 * would take the whole suite's database with it) so the cookie is the only
 * thing left claiming the session is good.
 */

const prisma = new PrismaClient();

const stamp = Date.now().toString().slice(-9);
const name = `e2ed${stamp}`;
const password = "password";

test.afterAll(async () => {
  // The user row is gone by the time the test runs its assertion; nothing
  // left to clean up beyond disconnecting.
  await prisma.$disconnect();
});

test("a session for a deleted user lands on /sign-in instead of crashing", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Gebruikersnaam").fill(name);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Registreren" }).click();
  await page.waitForURL(/household-setup/, { timeout: 30_000 });

  // The cookie is now signed for this user's id; deleting the row keeps the
  // cookie but pulls the ground out from under it.
  await prisma.user.delete({ where: { name } });

  await page.goto("/home");
  await page.waitForURL(/\/sign-in/, { timeout: 30_000 });
  await expect(page.getByLabel("Gebruikersnaam")).toBeVisible();
});
