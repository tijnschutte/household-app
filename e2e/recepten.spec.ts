import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The Recepten module, requested from a running server.
 *
 * Follows the shape of home.spec.ts and grocery-list.spec.ts: its own account
 * and household, cleaned up via Prisma afterwards, every assertion made
 * through the UI. What only a real browser can prove here:
 *
 *  - the list, form, detail and "Lijkt op" screens are all async Server
 *    Components — the same "nothing below the skeleton" risk `home.spec.ts`
 *    guards for.
 *  - the ingredient-name autocomplete, the tag chips and the step editor are
 *    laid out and hydrated, none of which happens in the happy-dom unit tests.
 *  - "In mandje" crosses the module boundary into the shared grocery list —
 *    the merge (`recepten/basket.ts`) is unit-tested for the pure rule, but
 *    only a real transaction plus a real render of /home proves the sheet and
 *    the list agree on what happened, twice (create, then sum).
 *  - scoping: a second household must not see the first's recipe on the list
 *    screen, and must get a real 404 for its detail URL.
 */

const prisma = new PrismaClient();

// Usernames are unique and capped at 15 characters.
const stamp = Date.now().toString().slice(-9);
const prefix = `e2er${stamp}`;
const password = "password";

const addBarOf = (page: Page) => page.getByPlaceholder("Voeg een item toe...");
const tabBar = (page: Page) => page.locator('nav[aria-label="Hoofdnavigatie"]');
const goToRecepten = (page: Page) => tabBar(page).getByRole("link", { name: "Recepten" }).click();
const goToMandje = (page: Page) => tabBar(page).getByRole("link", { name: "Mandje" }).click();

async function signUpAndFoundHousehold(page: Page, suffix: string) {
  const name = `${prefix}${suffix}`;
  await page.goto("/sign-up");
  await page.getByLabel("Gebruikersnaam").fill(name);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Registreren" }).click();
  await page.waitForURL(/household-setup/, { timeout: 30_000 });

  await page.getByLabel("Huishoudnaam").fill(`Huis ${prefix}${suffix}`);
  await page.getByRole("button", { name: "Huishouden aanmaken" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
  await expect(addBarOf(page)).toBeVisible({ timeout: 30_000 });

  return prisma.user.findFirstOrThrow({ where: { name } });
}

/** The id `/recepten/nieuw` -> Bewaar lands on, read off the resulting URL. */
async function idFromUrl(page: Page): Promise<number> {
  await page.waitForURL(/\/recepten\/\d+$/, { timeout: 30_000 });
  return Number(new URL(page.url()).pathname.split("/").pop());
}

async function openRecipe(page: Page, id: number) {
  await goToRecepten(page);
  await page.locator(`a[href="/recepten/${id}"]`).click();
  await page.waitForURL(new RegExp(`/recepten/${id}$`), { timeout: 30_000 });
}

/** The entry row of the form: three fields and a plus. */
async function addIngredient(page: Page, name: string, quantity = "", unit = "") {
  if (quantity) await page.getByLabel("Aantal").fill(quantity);
  if (unit) await page.getByLabel("Eenheid").fill(unit);
  await page.getByLabel("Ingrediënt", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ingrediënt toevoegen" }).click();
  await expect(page.getByRole("button", { name: `${name} verwijderen` })).toBeVisible();
}

async function openMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Meer" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { name: { startsWith: prefix } } });
  const householdIds = users.flatMap((u) => (u.householdId ? [u.householdId] : []));
  const householdScope = { householdId: { in: householdIds } };
  const userScope = {
    OR: [{ userId: { in: users.map((u) => u.id) } }, { householdId: { in: householdIds } }],
  };

  // RecipeIngredient cascades off Recipe; Ingredient and RecipeTag don't
  // cascade off anything and must be cleared explicitly.
  await prisma.recipe.deleteMany({ where: householdScope });
  await prisma.ingredient.deleteMany({ where: householdScope });
  await prisma.recipeTag.deleteMany({ where: householdScope });
  await prisma.grocery.deleteMany({ where: userScope });
  await prisma.category.deleteMany({ where: userScope });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
  await prisma.$disconnect();
});

test("the Recepten story: empty state, create, view, search, basket, lijkt op, edit, delete", async ({
  page,
}) => {
  await signUpAndFoundHousehold(page, "a");

  // --- 1. empty state, and the + in the header reaches the form -----------
  await goToRecepten(page);
  await expect(page.getByText("Nog geen recepten")).toBeVisible();

  await page.getByRole("link", { name: "Nieuw recept" }).click();
  await page.waitForURL(/\/recepten\/nieuw$/, { timeout: 30_000 });

  // --- 2. create a recipe: title, tag, three-field ingredients, steps -----
  const recipe1Title = `Pastasalade ${stamp}`;
  const tagName = `Snel ${stamp}`;

  await page.getByLabel("Titel").fill(recipe1Title);

  await page.getByRole("button", { name: "Tag" }).click();
  await page.getByLabel("Nieuwe tag").fill(tagName);
  await page.getByLabel("Nieuwe tag").press("Enter");
  await expect(page.getByRole("button", { name: tagName })).toHaveAttribute("aria-pressed", "true");

  await addIngredient(page, "pasta", "400", "g");
  await addIngredient(page, "basilicum");

  await page.getByLabel("Stap 1").fill("Kook de pasta.");
  await page.getByLabel("Stap 1").press("Enter");
  await page.getByLabel("Stap 2").fill("Meng met pesto en basilicum.");

  // The phone width the design was drawn at: the entry row must fit.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Ingrediënt toevoegen" })).toBeInViewport();
  await page.screenshot({ path: "test-results/recepten-390-form.png" });
  await page.setViewportSize({ width: 420, height: 900 });

  await page.getByRole("button", { name: "Bewaar" }).click();
  const id1 = await idFromUrl(page);

  // --- 3. the recipe: ingredients left, bereiding right ---------------------
  await expect(page.getByRole("heading", { name: recipe1Title })).toBeVisible();
  await expect(page.getByText(tagName, { exact: true })).toBeVisible();

  const pastaRow = page.locator("li", { hasText: "pasta" });
  await expect(pastaRow).toContainText("400 g");
  await expect(page.locator("li", { hasText: "basilicum" })).toBeVisible();

  await page.getByRole("tab", { name: "Bereiding" }).click();
  const step1 = page.getByRole("button", { name: "Kook de pasta." });
  await expect(step1).toBeVisible();
  await expect(page.getByRole("button", { name: "Meng met pesto en basilicum." })).toBeVisible();
  await step1.click();
  await expect(step1).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "Ingrediënten" }).click();
  await expect(pastaRow).toBeVisible();

  // --- 4. a second recipe, sharing "pasta" through the autocomplete ------
  const recipe2Title = `Tomatensoep ${stamp}`;

  await goToRecepten(page);
  await page.getByRole("link", { name: "Nieuw recept" }).click();
  await page.waitForURL(/\/recepten\/nieuw$/, { timeout: 30_000 });

  await page.getByLabel("Titel").fill(recipe2Title);

  const nameField = page.getByLabel("Ingrediënt", { exact: true });
  await nameField.fill("pas");
  const suggestion = page.getByRole("button", { name: "pasta", exact: true });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(nameField).toHaveValue("pasta");
  await page.getByRole("button", { name: "Ingrediënt toevoegen" }).click();
  await addIngredient(page, "ui");

  await page.getByRole("button", { name: "Bewaar" }).click();
  const id2 = await idFromUrl(page);
  await expect(page.getByRole("heading", { name: recipe2Title })).toBeVisible();

  // --- 5. search by title or ingredient, and the tag chips ----------------
  await goToRecepten(page);
  const row1 = page.locator(`a[href="/recepten/${id1}"]`);
  const row2 = page.locator(`a[href="/recepten/${id2}"]`);
  await expect(row1).toBeVisible();
  await expect(row2).toBeVisible();

  const search = page.getByLabel("Zoek op naam of ingrediënt");
  await search.fill("pastasalade");
  await expect(row1).toBeVisible();
  await expect(row2).toBeHidden();

  await search.fill("basilicum");
  await expect(row1).toBeVisible();
  await expect(row2).toBeHidden();

  await search.fill("");
  await expect(row2).toBeVisible();

  await page.getByRole("button", { name: tagName }).click();
  await expect(row1).toBeVisible();
  await expect(row2).toBeHidden();
  await page.getByRole("button", { name: "Alles" }).click();
  await expect(row2).toBeVisible();

  // --- 6. "In mandje": the sheet, the merge on /home, and its trace back ---
  await openRecipe(page, id1);
  const basketButton = page.locator("footer").getByRole("button", { name: /mandje|lijst/ });
  await expect(basketButton).toHaveText("In mandje");
  await basketButton.click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("checkbox", { name: /pasta/ })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await sheet.getByRole("button", { name: "2 items toevoegen" }).click();
  await expect(page.getByText("2 items in je mandje")).toBeVisible();
  await expect(sheet).toBeHidden();
  // The server re-renders the recipe: everything is on the list now.
  await expect(basketButton).toHaveText("Op de lijst");
  await expect(page.getByText("in mandje")).toHaveCount(2);

  await goToMandje(page);
  const pastaGroceryRow = page.locator("[data-row-body]", {
    has: page.getByRole("button", { name: "pasta hernoemen" }),
  });
  await expect(pastaGroceryRow).toBeVisible({ timeout: 30_000 });
  await expect(pastaGroceryRow).toContainText("400 g");
  await expect(pastaGroceryRow).toContainText(recipe1Title);
  await expect(page.getByRole("button", { name: "basilicum hernoemen" })).toBeVisible();

  // A hand-typed item carries no such trace.
  await addBarOf(page).fill("boter");
  await addBarOf(page).press("Enter");
  const boterRow = page.locator("[data-row-body]", {
    has: page.getByRole("button", { name: "boter hernoemen" }),
  });
  await expect(boterRow).toBeVisible();
  await expect(boterRow).not.toContainText(recipe1Title);

  // Adding again: the sheet says what will happen, then the list shows it.
  await openRecipe(page, id1);
  await expect(basketButton).toHaveText("Op de lijst");
  await basketButton.click();
  await expect(sheet.getByText("staat al op de lijst · wordt 800 g")).toBeVisible();
  await sheet.getByRole("checkbox", { name: /basilicum/ }).click();
  await sheet.getByRole("button", { name: "1 item toevoegen" }).click();
  await expect(sheet).toBeHidden();

  await goToMandje(page);
  await expect(page.getByRole("button", { name: "pasta hernoemen" })).toHaveCount(1);
  await expect(pastaGroceryRow).toContainText("800 g");

  // --- 7. "Lijkt op": recipes ranked by shared ingredients -----------------
  await openRecipe(page, id1);
  await page.getByRole("link", { name: "Lijkt op" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}/lijkt-op$`), { timeout: 30_000 });

  const similarRow = page.locator("li", { hasText: recipe2Title });
  await expect(similarRow).toContainText("1 van 2 gedeeld");
  await expect(similarRow).toContainText("Nog 1 nodig");

  await page.getByRole("button", { name: "basilicum" }).click();
  await expect(similarRow).toBeHidden();
  await expect(page.getByText(`Geen ander recept met basilicum`)).toBeVisible();
  await page.getByRole("button", { name: "pasta", exact: true }).click();
  await expect(similarRow).toBeVisible();

  await similarRow.getByRole("link").click();
  await page.waitForURL(new RegExp(`/recepten/${id2}$`), { timeout: 30_000 });

  // --- 8. edit, from the ⋯ menu ------------------------------------------
  await openRecipe(page, id1);
  await openMenu(page, "Bewerken");
  await page.waitForURL(new RegExp(`/recepten/${id1}/bewerken$`), { timeout: 30_000 });
  await expect(page.getByLabel("Titel")).toHaveValue(recipe1Title);
  await expect(page.getByLabel("Stap 1")).toHaveValue("Kook de pasta.");

  const renamedTitle = `${recipe1Title} bewerkt`;
  await page.getByLabel("Titel").fill(renamedTitle);
  await page.getByRole("button", { name: "Bewaar" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // --- 9. delete, from the ⋯ menu: cancel leaves it, confirm removes it ---
  await openMenu(page, "Verwijderen");
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(deleteDialog).toBeHidden();

  await openMenu(page, "Verwijderen");
  await deleteDialog.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await page.waitForURL(/\/recepten$/, { timeout: 30_000 });
  await expect(row1).toBeHidden();
  await expect(row2).toBeVisible();

  // --- 10. scoping: a second household can't see or reach this one's recipe
  const secondDevice = await page.context().browser()!.newContext();
  const otherPage = await secondDevice.newPage();
  await signUpAndFoundHousehold(otherPage, "b");

  await goToRecepten(otherPage);
  await expect(otherPage.getByText("Nog geen recepten")).toBeVisible();
  await expect(otherPage.locator(`a[href="/recepten/${id2}"]`)).toBeHidden();

  const response = await otherPage.goto(`/recepten/${id2}`);
  expect(response?.status()).toBe(404);

  await secondDevice.close();
});
