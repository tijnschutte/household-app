/**
 * Recipes are household-shared, like RecurringItem — any member of the
 * household may write to any recipe, but never to another household's. That
 * scoping, and the merge `addRecipeToBasket` does against a real shared list,
 * are what only a database can prove.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  addRecipeToBasket,
} from "@/src/lib/recepten/actions";
import { getRecipe, getRecipes } from "@/src/lib/recepten/data";
import { aHouseholdWith, aGrocery } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

type RecipeLine = { name: string; quantity?: number | null; unit?: string | null };

async function aRecipe(householdId: number, title: string, lines: RecipeLine[] = []) {
  const ingredients = await Promise.all(
    lines.map((line) =>
      db.ingredient.upsert({
        where: { householdId_name: { householdId, name: line.name } },
        update: {},
        create: { householdId, name: line.name },
      })
    )
  );

  return db.recipe.create({
    data: {
      householdId,
      title,
      instructions: "",
      ingredients: {
        create: ingredients.map((ingredient, index) => ({
          ingredientId: ingredient.id,
          quantity: lines[index].quantity ?? null,
          unit: lines[index].unit ?? null,
          position: index,
        })),
      },
    },
  });
}

async function twoHouseholds() {
  const [ours, theirs] = await Promise.all([aHouseholdWith("sam"), aHouseholdWith("robin")]);
  return { ours, theirs };
}

describe("recipes are confined to the caller's household", () => {
  it("getRecipe returns null for another household's recipe", async () => {
    const { ours, theirs } = await twoHouseholds();
    const recipe = await aRecipe(ours.household.id, "Pasta pesto", [{ name: "pasta" }]);

    signInAs(theirs.member);

    expect(await getRecipe(recipe.id)).toBeNull();
  });

  it("getRecipes never lists another household's recipes", async () => {
    const { ours, theirs } = await twoHouseholds();
    await aRecipe(ours.household.id, "Van hen", [{ name: "ui" }]);
    await aRecipe(theirs.household.id, "Van ons", [{ name: "ui" }]);

    signInAs(theirs.member);

    expect((await getRecipes()).map((r) => r.title)).toEqual(["Van ons"]);
  });

  it("refuses to update another household's recipe, and leaves it as it was", async () => {
    const { ours, theirs } = await twoHouseholds();
    const recipe = await aRecipe(ours.household.id, "Pasta pesto", [{ name: "pasta" }]);

    signInAs(theirs.member);
    const result = await updateRecipe(recipe.id, {
      title: "Gekaapt",
      instructions: "",
      ingredients: [{ name: "pasta", quantity: null, unit: null }],
      tags: [],
    });

    expect(result).toMatchObject({ success: false });
    expect(await db.recipe.findUnique({ where: { id: recipe.id } })).toMatchObject({
      title: "Pasta pesto",
    });
  });

  it("refuses to delete another household's recipe", async () => {
    const { ours, theirs } = await twoHouseholds();
    const recipe = await aRecipe(ours.household.id, "Pasta pesto", [{ name: "pasta" }]);

    signInAs(theirs.member);

    await expect(deleteRecipe(recipe.id)).rejects.toThrow();
    expect(await db.recipe.findUnique({ where: { id: recipe.id } })).not.toBeNull();
  });

  it("update count is zero for a recipe id that belongs to nobody", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    const result = await updateRecipe(999_999, {
      title: "Onbestaand",
      instructions: "",
      ingredients: [{ name: "ui", quantity: null, unit: null }],
      tags: [],
    });

    expect(result).toMatchObject({ success: false });
  });
});

describe("getRecipe reports onList (D2)", () => {
  it("is true once every ingredient is on the shared list and not bought", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta" },
      { name: "kaas" },
    ]);
    await aGrocery({ householdId: household.id }, { name: "pasta" });
    await aGrocery({ householdId: household.id }, { name: "kaas" });

    signInAs(member);
    expect(await getRecipe(recipe.id)).toMatchObject({ onList: true });
  });

  it("is false while an ingredient is missing from the list", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta" },
      { name: "kaas" },
    ]);
    await aGrocery({ householdId: household.id }, { name: "pasta" });

    signInAs(member);
    expect(await getRecipe(recipe.id)).toMatchObject({ onList: false });
  });

  it("is false while an ingredient on the list is already bought", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const recipe = await aRecipe(household.id, "Pasta pesto", [{ name: "pasta" }]);
    await aGrocery({ householdId: household.id }, { name: "pasta", bought: true });

    signInAs(member);
    expect(await getRecipe(recipe.id)).toMatchObject({ onList: false });
  });
});

describe("createRecipe / updateRecipe reject a duplicate title", () => {
  it("refuses a second recipe with the same title in the same household", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aRecipe(household.id, "Pasta pesto");

    signInAs(member);
    const result = await createRecipe({
      title: "Pasta pesto",
      instructions: "",
      ingredients: [{ name: "pasta", quantity: null, unit: null }],
      tags: [],
    });

    expect(result).toMatchObject({ success: false });
  });

  it("allows the same title in a different household", async () => {
    const { ours, theirs } = await twoHouseholds();
    await aRecipe(ours.household.id, "Pasta pesto");

    signInAs(theirs.member);
    const result = await createRecipe({
      title: "Pasta pesto",
      instructions: "",
      ingredients: [{ name: "pasta", quantity: null, unit: null }],
      tags: [],
    });

    expect(result.success).toBe(true);
  });

  it("refuses renaming a recipe onto a title already used in the household", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aRecipe(household.id, "Bestaat al");
    const toRename = await aRecipe(household.id, "Nog vrij", [{ name: "ui" }]);

    signInAs(member);
    const result = await updateRecipe(toRename.id, {
      title: "Bestaat al",
      instructions: "",
      ingredients: [{ name: "ui", quantity: null, unit: null }],
      tags: [],
    });

    expect(result).toMatchObject({ success: false });
  });
});

describe("addRecipeToBasket", () => {
  it("creates a line for an ingredient not yet on the list", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta", quantity: 200, unit: "gram" },
    ]);

    signInAs(member);
    await addRecipeToBasket(recipe.id);

    const row = await db.grocery.findFirst({ where: { householdId: household.id, name: "pasta" } });
    expect(row).toMatchObject({ quantity: expect.anything(), unit: "gram", bought: false });
    expect(Number(row!.quantity)).toBe(200);
  });

  it("sums the quantity into an unbought row with the same unit", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "pasta" });
    await db.grocery.updateMany({
      where: { householdId: household.id, name: "pasta" },
      data: { quantity: 100, unit: "gram" },
    });
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta", quantity: 200, unit: "gram" },
    ]);

    signInAs(member);
    await addRecipeToBasket(recipe.id);

    const row = await db.grocery.findFirst({ where: { householdId: household.id, name: "pasta" } });
    expect(Number(row!.quantity)).toBe(300);
  });

  it("un-boughts a bought row with the line's own quantity, not a sum", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "pasta", bought: true });
    await db.grocery.updateMany({
      where: { householdId: household.id, name: "pasta" },
      data: { quantity: 100, unit: "gram" },
    });
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta", quantity: 200, unit: "gram" },
    ]);

    signInAs(member);
    await addRecipeToBasket(recipe.id);

    const row = await db.grocery.findFirst({ where: { householdId: household.id, name: "pasta" } });
    expect(row).toMatchObject({ bought: false });
    expect(Number(row!.quantity)).toBe(200);
  });

  it("leaves an unbought row alone when the unit differs, and does not error", async () => {
    const { household, member } = await aHouseholdWith("sam");
    await aGrocery({ householdId: household.id }, { name: "pasta" });
    await db.grocery.updateMany({
      where: { householdId: household.id, name: "pasta" },
      data: { quantity: 1, unit: "pak" },
    });
    const recipe = await aRecipe(household.id, "Pasta pesto", [
      { name: "pasta", quantity: 200, unit: "gram" },
    ]);

    signInAs(member);
    await addRecipeToBasket(recipe.id);

    const row = await db.grocery.findFirst({ where: { householdId: household.id, name: "pasta" } });
    expect(Number(row!.quantity)).toBe(1);
    expect(row!.unit).toBe("pak");
  });

  it("refuses to add another household's recipe to the caller's list", async () => {
    const { ours, theirs } = await twoHouseholds();
    const recipe = await aRecipe(ours.household.id, "Pasta pesto", [{ name: "pasta" }]);

    signInAs(theirs.member);

    await expect(addRecipeToBasket(recipe.id)).rejects.toThrow();
    expect(await db.grocery.count({ where: { householdId: theirs.household.id } })).toBe(0);
  });

  describe("sourceRecipeId (D1)", () => {
    it("stamps a newly created row with the recipe that added it", async () => {
      const { household, member } = await aHouseholdWith("sam");
      const recipe = await aRecipe(household.id, "Pasta pesto", [{ name: "pasta" }]);

      signInAs(member);
      await addRecipeToBasket(recipe.id);

      const row = await db.grocery.findFirst({
        where: { householdId: household.id, name: "pasta" },
      });
      expect(row?.sourceRecipeId).toBe(recipe.id);
    });

    it("stamps an updated row too, even one that started out hand-typed", async () => {
      const { household, member } = await aHouseholdWith("sam");
      const handTyped = await aGrocery({ householdId: household.id }, { name: "pasta" });
      expect(handTyped.sourceRecipeId).toBeNull();
      const recipe = await aRecipe(household.id, "Pasta pesto", [{ name: "pasta" }]);

      signInAs(member);
      await addRecipeToBasket(recipe.id);

      const row = await db.grocery.findUnique({ where: { id: handTyped.id } });
      expect(row?.sourceRecipeId).toBe(recipe.id);
    });

    it("the latest recipe wins when a second recipe adds the same ingredient", async () => {
      const { household, member } = await aHouseholdWith("sam");
      const first = await aRecipe(household.id, "Pasta pesto", [{ name: "pasta" }]);
      const second = await aRecipe(household.id, "Pasta carbonara", [{ name: "pasta" }]);

      signInAs(member);
      await addRecipeToBasket(first.id);
      await addRecipeToBasket(second.id);

      const row = await db.grocery.findFirst({
        where: { householdId: household.id, name: "pasta" },
      });
      expect(row?.sourceRecipeId).toBe(second.id);
    });

    it("deleting the recipe nulls the trace on the row, but the row stays", async () => {
      const { household, member } = await aHouseholdWith("sam");
      const recipe = await aRecipe(household.id, "Pasta pesto", [
        { name: "pasta", quantity: 200, unit: "gram" },
      ]);

      signInAs(member);
      await addRecipeToBasket(recipe.id);
      await db.recipe.delete({ where: { id: recipe.id } });

      const row = await db.grocery.findFirst({
        where: { householdId: household.id, name: "pasta" },
      });
      expect(row).not.toBeNull();
      expect(row?.sourceRecipeId).toBeNull();
      expect(Number(row!.quantity)).toBe(200);
    });
  });
});
