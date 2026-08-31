import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The Recepten module, requested from a running server.
 *
 * Follows the shape of home.spec.ts and grocery-list.spec.ts: its own account
 * and household, cleaned up via Prisma afterwards, every assertion made
 * through the UI. What only a real browser can prove here:
 *
 *  - the list, form and detail screens are all async Server Components —
 *    the same "nothing below the skeleton" risk `home.spec.ts` guards for.
 *  - the ingredient-name autocomplete and the tag chips are laid out and
 *    hydrated, neither of which happens in the RTL/happy-dom unit tests for
 *    these components.
 *  - "In mandje" crosses the module boundary into the shared grocery list —
 *    the merge (`recepten/basket.ts`) is unit-tested for the pure rule, but
 *    only a real transaction plus a real render of /home proves the button
 *    and the list agree on what happened, twice (create, then sum).
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
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Registreren" }).click();
  await page.waitForURL(/household-setup/, { timeout: 30_000 });

  await page.getByLabel("Huishoudnaam").fill(`Huis ${prefix}${suffix}`);
  await page.getByRole("button", { name: "Huishouden aanmaken" }).click();
  await page.waitForURL(/\/home/, { timeout: 30_000 });
  await expect(addBarOf(page)).toBeVisible({ timeout: 30_000 });

  return prisma.user.findFirstOrThrow({ where: { name } });
}

/** The id `/recepten/nieuw` -> Opslaan lands on, read off the resulting URL. */
async function idFromUrl(page: Page): Promise<number> {
  await page.waitForURL(/\/recepten\/\d+$/, { timeout: 30_000 });
  return Number(new URL(page.url()).pathname.split("/").pop());
}

async function openRecipe(page: Page, id: number) {
  await goToRecepten(page);
  await page.locator(`a[href="/recepten/${id}"]`).click();
  await page.waitForURL(new RegExp(`/recepten/${id}$`), { timeout: 30_000 });
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

test("the Recepten story: empty state, create, autocomplete, filter, basket, match, edit, delete", async ({
  page,
}) => {
  await signUpAndFoundHousehold(page, "a");

  // --- 1. empty state, and the FAB reaches the form ----------------------
  await goToRecepten(page);
  await expect(page.getByText("Nog geen recepten")).toBeVisible();
  await expect(page.getByText("Voeg je eerste recept toe met de knop rechtsonder.")).toBeVisible();

  await page.getByRole("link", { name: "Nieuw recept" }).click();
  await page.waitForURL(/\/recepten\/nieuw$/, { timeout: 30_000 });

  // --- 2. create a recipe -------------------------------------------------
  const recipe1Title = `Pastasalade ${stamp}`;
  const tagName = `Snel ${stamp}`;

  await page.getByLabel("Titel").fill(recipe1Title);

  await page.getByRole("button", { name: "+ nieuw" }).click();
  await page.getByPlaceholder("Nieuwe categorie").fill(tagName);
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByRole("button", { name: tagName })).toBeVisible();

  await page.getByLabel("Ingrediëntnaam").nth(0).fill("pasta");
  await page.getByLabel("Hoeveelheid").nth(0).fill("400");
  await page.getByLabel("Eenheid").nth(0).fill("g");

  await page.getByRole("button", { name: "Ingrediënt", exact: true }).click();
  await page.getByLabel("Ingrediëntnaam").nth(1).fill("basilicum");

  // B5: the column labels ("Ingrediënt", "Aantal", "Eenheid") replace
  // placeholders that used to clip at 390px — check them at that width, and
  // keep a screenshot to read by eye.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("span", { hasText: "Ingrediënt" })).toBeVisible();
  await expect(page.locator("span", { hasText: "Aantal" })).toBeVisible();
  await expect(page.locator("span", { hasText: "Eenheid" })).toBeVisible();
  await page.screenshot({ path: "test-results/recepten-390-column-labels.png" });
  await page.setViewportSize({ width: 420, height: 900 });

  await page.getByLabel("Bereiding").fill("Kook de pasta.\n\nMeng met pesto en basilicum.");

  await page.getByRole("button", { name: "Opslaan" }).click();
  const id1 = await idFromUrl(page);

  await expect(page.getByRole("heading", { name: recipe1Title })).toBeVisible();
  await expect(page.getByText(tagName, { exact: true })).toBeVisible();

  const pastaRow = page.locator("li", { hasText: "pasta" });
  await expect(pastaRow).toContainText("400 g");
  await expect(page.locator("li", { hasText: "basilicum" })).toBeVisible();

  await page.getByRole("tab", { name: "Recept" }).click();
  const paragraphs = page.locator("main p");
  await expect(paragraphs).toHaveCount(2);
  await expect(paragraphs.nth(0)).toHaveText("Kook de pasta.");
  await expect(paragraphs.nth(1)).toHaveText("Meng met pesto en basilicum.");

  // --- 3. a second recipe, sharing "pasta" through the autocomplete ------
  const recipe2Title = `Tomatensoep ${stamp}`;

  await goToRecepten(page);
  await page.getByRole("link", { name: "Nieuw recept" }).click();
  await page.waitForURL(/\/recepten\/nieuw$/, { timeout: 30_000 });

  await page.getByLabel("Titel").fill(recipe2Title);

  const ingredientNameField = page.getByLabel("Ingrediëntnaam").nth(0);
  await ingredientNameField.fill("pas");
  const suggestion = page.getByRole("button", { name: "pasta" });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(ingredientNameField).toHaveValue("pasta");

  await page.getByRole("button", { name: "Ingrediënt", exact: true }).click();
  await page.getByLabel("Ingrediëntnaam").nth(1).fill("ui");

  await page.getByRole("button", { name: "Opslaan" }).click();
  const id2 = await idFromUrl(page);
  await expect(page.getByRole("heading", { name: recipe2Title })).toBeVisible();

  // --- 4. search and tag filters on /recepten -----------------------------
  await goToRecepten(page);
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeVisible();

  await page.getByLabel("Zoek op titel").fill("pastasalade");
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeHidden();

  await page.getByLabel("Zoek op titel").fill("");
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeVisible();

  const tagFilter = page.getByRole("button", { name: "Filter op categorie" });
  await tagFilter.click();
  await expect(page.getByText("Toont recepten met álle gekozen categorieën")).toBeVisible();
  await page.getByRole("menuitemcheckbox", { name: tagName }).click();
  // Ticking one keeps the menu open for the next; the trigger now reads the selection.
  await expect(page.getByRole("menuitemcheckbox", { name: tagName })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tagFilter).toHaveText(tagName);
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeHidden();

  // D5: the × beside the trigger clears the selection without reopening the menu.
  const clearFilter = page.getByRole("button", { name: "Filter wissen" });
  await expect(clearFilter).toBeVisible();
  await clearFilter.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(tagFilter).toHaveText("Alle categorieën");
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeVisible();

  // --- 4b. selecting two tags narrows, it doesn't widen -------------------
  // Give recipe 2 tagName as well, plus a second tag of its own, so it's the
  // only recipe carrying both while recipe 1 carries only one of them.
  const secondTagName = `Vega ${stamp}`;
  await openRecipe(page, id2);
  await page.getByRole("link", { name: "Recept bewerken" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id2}/bewerken$`), { timeout: 30_000 });

  await page.getByRole("button", { name: tagName }).click();
  await page.getByRole("button", { name: "+ nieuw" }).click();
  await page.getByPlaceholder("Nieuwe categorie").fill(secondTagName);
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await expect(page.getByRole("button", { name: secondTagName })).toBeVisible();

  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id2}$`), { timeout: 30_000 });

  await goToRecepten(page);
  await tagFilter.click();
  await page.getByRole("menuitemcheckbox", { name: tagName }).click();
  await page.getByRole("menuitemcheckbox", { name: secondTagName }).click();
  await page.keyboard.press("Escape");
  await expect(tagFilter).toHaveText(`${tagName}, ${secondTagName}`);
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeHidden();
  await expect(page.locator(`a[href="/recepten/${id2}"]`)).toBeVisible();

  await tagFilter.click();
  await page.getByRole("menuitem", { name: "Alles tonen" }).click();
  await expect(tagFilter).toHaveText("Alle categorieën");

  // --- 5. "In mandje", the merge on /home, and its trace back (D1, D2) ----
  await openRecipe(page, id1);
  // "In mandje" while nothing is on the list yet: adds directly, no confirm.
  const basketButton = page.locator("footer").getByRole("button", { name: /mandje/i });
  await expect(basketButton).toHaveText("In mandje");
  await basketButton.click();
  await expect(basketButton).toHaveClass(/bg-green-600/);

  await goToMandje(page);
  const pastaGroceryRow = page.locator("[data-row-body]", {
    has: page.getByRole("button", { name: "pasta hernoemen" }),
  });
  await expect(pastaGroceryRow).toBeVisible({ timeout: 30_000 });
  await expect(pastaGroceryRow).toContainText("400 g");
  // D1: a row a recipe wrote carries the recipe's name under it.
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

  await openRecipe(page, id1);
  // The server now knows every ingredient is on the list: the button reads
  // "Al in mandje" and asks before adding again, rather than just doubling
  // the quantities silently (D2).
  await expect(basketButton).toHaveText("Al in mandje");
  await basketButton.click();
  const reAddDialog = page.getByRole("alertdialog");
  await expect(reAddDialog.getByText("Nog een keer toevoegen?")).toBeVisible();
  await reAddDialog.getByRole("button", { name: "Toevoegen" }).click();
  await expect(basketButton).toHaveClass(/bg-green-600/);

  await goToMandje(page);
  await expect(page.getByRole("button", { name: "pasta hernoemen" })).toHaveCount(1);
  await expect(pastaGroceryRow).toContainText("800 g");

  // --- 6. recipes sharing ingredients, from the ingredient list ------------
  await openRecipe(page, id1);
  await expect(page.locator("footer").getByRole("button", { name: "Combineer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Deelt ingrediënten met andere recepten" }).click();
  const combineSheet = page.getByRole("dialog");
  await expect(combineSheet.getByText(`samen met ${recipe1Title} in te kopen`)).toBeVisible();

  const recipe2Row = combineSheet.locator("li", { hasText: recipe2Title });
  await expect(recipe2Row).toContainText("deelt: pasta");

  await recipe2Row.getByRole("link", { name: /Bekijken/ }).click();
  await page.waitForURL(new RegExp(`/recepten/${id2}$`), { timeout: 30_000 });

  // Back to recipe 1 for the edit/delete story below.
  await openRecipe(page, id1);

  // --- 7. edit ---------------------------------------------------------------
  await page.getByRole("link", { name: "Recept bewerken" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}/bewerken$`), { timeout: 30_000 });
  await expect(page.getByLabel("Titel")).toHaveValue(recipe1Title);

  const renamedTitle = `${recipe1Title} bewerkt`;
  await page.getByLabel("Titel").fill(renamedTitle);
  await page.getByRole("button", { name: "Opslaan" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: renamedTitle })).toBeVisible();

  // Deleting lives on the edit page only — the detail page a household member
  // reads while cooking offers no way to destroy the recipe.
  await expect(page.getByRole("button", { name: "Recept verwijderen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verwijderen", exact: true })).toHaveCount(0);

  // --- 8. delete, from the edit page: cancel leaves it, confirm removes it --
  await page.getByRole("link", { name: "Recept bewerken" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}/bewerken$`), { timeout: 30_000 });

  await page.getByRole("button", { name: "Recept verwijderen" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Annuleren" }).click();
  await expect(deleteDialog).toBeHidden();

  await goToRecepten(page);
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeVisible();

  await openRecipe(page, id1);
  await page.getByRole("link", { name: "Recept bewerken" }).click();
  await page.waitForURL(new RegExp(`/recepten/${id1}/bewerken$`), { timeout: 30_000 });
  await page.getByRole("button", { name: "Recept verwijderen" }).click();
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Verwijderen", exact: true }).click();
  await page.waitForURL(/\/recepten$/, { timeout: 30_000 });
  await expect(page.locator(`a[href="/recepten/${id1}"]`)).toBeHidden();

  // --- 9. scoping: a second household can't see or reach this one's recipe -
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
