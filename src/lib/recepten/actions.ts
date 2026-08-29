"use server";

import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import { DomainError } from "@/src/lib/domain-error";
import { rejectingDuplicates } from "@/src/lib/db/duplicates";
import { requireHousehold } from "@/src/lib/session";
import { notifyHousehold } from "@/src/lib/notifications/notify";
import { recipeAddedToBasket } from "@/src/lib/notifications/topics";
import { recipeSchema, type RecipeInput } from "@/src/lib/recepten/schema";
import { mergeIntoList, type ListRow } from "@/src/lib/recepten/basket";
import { ownerOfList, scopeToList } from "@/src/lib/house/scope";

type Tx = Prisma.TransactionClient;

/**
 * Every ingredient name a recipe was saved with, upserted by (householdId,
 * name) so two recipes sharing "ui" share one row. Returns the id for each
 * name so the recipe's lines can be created in the same transaction.
 */
async function upsertIngredients(
  tx: Tx,
  householdId: number,
  names: string[]
): Promise<Map<string, number>> {
  const ingredients = await Promise.all(
    names.map((name) =>
      tx.ingredient.upsert({
        where: { householdId_name: { householdId, name } },
        update: {},
        create: { householdId, name },
      })
    )
  );
  return new Map(ingredients.map((ingredient) => [ingredient.name, ingredient.id]));
}

/** Every tag name a recipe was saved with, upserted by (householdId, name). */
async function upsertTags(tx: Tx, householdId: number, names: string[]) {
  return Promise.all(
    names.map((name) =>
      tx.recipeTag.upsert({
        where: { householdId_name: { householdId, name } },
        update: {},
        create: { householdId, name },
      })
    )
  );
}

function ingredientLines(
  validated: { ingredients: { name: string; quantity: number | null; unit: string | null }[] },
  ingredientIdByName: Map<string, number>
) {
  return validated.ingredients.map((line, index) => ({
    // The schema already normalised the name, and upsertIngredients was
    // called with exactly this list — the lookup cannot miss.
    ingredientId: ingredientIdByName.get(line.name)!,
    quantity: line.quantity,
    unit: line.unit,
    position: index,
  }));
}

export async function createRecipe(input: RecipeInput) {
  return executeAction({
    successMessage: "Recept aangemaakt",
    actionFn: async () => {
      const { householdId } = await requireHousehold();
      const validated = recipeSchema.parse(input);

      return prisma.$transaction(async (tx) => {
        const ingredientIdByName = await upsertIngredients(
          tx,
          householdId,
          validated.ingredients.map((line) => line.name)
        );
        const tags = await upsertTags(tx, householdId, validated.tags);

        return rejectingDuplicates(
          () =>
            tx.recipe.create({
              data: {
                householdId,
                title: validated.title,
                instructions: validated.instructions,
                tags: { connect: tags.map((tag) => ({ id: tag.id })) },
                ingredients: { create: ingredientLines(validated, ingredientIdByName) },
              },
            }),
          "Er is al een recept met deze naam"
        );
      });
    },
  });
}

export async function updateRecipe(id: number, input: RecipeInput) {
  return executeAction({
    successMessage: "Recept bijgewerkt",
    actionFn: async () => {
      const { householdId } = await requireHousehold();
      const validated = recipeSchema.parse(input);

      return prisma.$transaction(async (tx) => {
        const existing = await tx.recipe.findFirst({ where: { id, householdId } });
        if (!existing) {
          throw new DomainError("Recept niet gevonden");
        }

        const ingredientIdByName = await upsertIngredients(
          tx,
          householdId,
          validated.ingredients.map((line) => line.name)
        );
        const tags = await upsertTags(tx, householdId, validated.tags);

        // The lines are replaced wholesale rather than diffed: a recipe's
        // ingredient list is small and edited as a whole, so there is no
        // per-line history worth preserving across an edit.
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });

        await rejectingDuplicates(
          () =>
            tx.recipe.update({
              where: { id },
              data: {
                title: validated.title,
                instructions: validated.instructions,
                tags: { set: tags.map((tag) => ({ id: tag.id })) },
                ingredients: { create: ingredientLines(validated, ingredientIdByName) },
              },
            }),
          "Er is al een recept met deze naam"
        );
      });
    },
  });
}

export async function deleteRecipe(id: number) {
  const { householdId } = await requireHousehold();
  const result = await prisma.recipe.deleteMany({ where: { id, householdId } });
  if (result.count === 0) {
    throw new Error("Verwijderen mislukt");
  }
}

/**
 * Adds every ingredient on a recipe to the shared list, merging into whatever
 * is already there per `mergeIntoList`'s rules — one transaction, one push.
 */
export async function addRecipeToBasket(recipeId: number) {
  const caller = await requireHousehold();

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId: caller.householdId },
    include: { ingredients: { include: { ingredient: true } } },
  });
  if (!recipe) {
    throw new Error("Recept niet gevonden");
  }

  const lines = recipe.ingredients.map((line) => ({
    name: line.ingredient.name,
    quantity: line.quantity === null ? null : Number(line.quantity),
    unit: line.unit,
  }));

  const listScope = scopeToList(caller, false);
  const existing = await prisma.grocery.findMany({
    where: listScope,
    select: { id: true, name: true, quantity: true, unit: true, bought: true },
  });
  const existingRows: ListRow[] = existing.map((row) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    bought: row.bought ?? false,
  }));

  const { create, update } = mergeIntoList(lines, existingRows);
  const owner = ownerOfList(caller, false);

  await prisma.$transaction([
    ...create.map((line) =>
      prisma.grocery.create({
        data: {
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          categoryId: null,
          ...owner,
        },
      })
    ),
    ...update.map((row) =>
      prisma.grocery.update({
        where: { id: row.id },
        data: { quantity: row.quantity, unit: row.unit, bought: row.bought },
      })
    ),
  ]);

  const { householdId, userId, name: actorName } = caller;
  after(() =>
    notifyHousehold({
      householdId,
      actorUserId: userId,
      notification: recipeAddedToBasket(actorName, recipe.title),
    })
  );
}
