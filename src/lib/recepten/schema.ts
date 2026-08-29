import { z } from "zod";

/**
 * What the server accepts for a recipe: title, instructions, at least one
 * ingredient line, and any number of tags. Shared by the form (client-side
 * safeParse, mirroring signUpSchema's pattern) and the action that writes it.
 *
 * Ingredient names are normalised (trimmed, lowercased) here rather than left
 * to the caller — that's the same string `getIngredientNames` reads back and
 * `Ingredient.name` is unique on, so two spellings of "ui" must collapse to one
 * row before they ever reach Prisma.
 */

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

const quantitySchema = z
  .number()
  .positive("Hoeveelheid moet groter dan nul zijn")
  .refine(hasAtMostTwoDecimals, "Hoeveelheid mag maximaal 2 decimalen hebben")
  .nullable();

const unitSchema = z
  .string()
  .trim()
  .max(12, "Eenheid mag maximaal 12 karakters zijn")
  .transform((value) => value.toLowerCase())
  .nullable();

const ingredientLineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Naam is vereist")
    .max(40, "Naam mag maximaal 40 karakters zijn")
    .transform((value) => value.toLowerCase()),
  quantity: quantitySchema,
  unit: unitSchema,
});

/** Keeps the first line for each normalised name; later duplicates are dropped. */
function dedupeByName<T extends { name: string }>(lines: T[]): T[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.name)) return false;
    seen.add(line.name);
    return true;
  });
}

export const recipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Titel is vereist")
    .max(80, "Titel mag maximaal 80 karakters zijn"),
  instructions: z.string().max(5000, "Bereiding mag maximaal 5000 karakters zijn"),
  ingredients: z
    .array(ingredientLineSchema)
    .min(1, "Voeg minstens 1 ingrediënt toe")
    .transform(dedupeByName),
  tags: z.array(
    z
      .string()
      .trim()
      .min(1, "Categorienaam is vereist")
      .max(30, "Categorienaam mag maximaal 30 karakters zijn")
  ),
});

export type RecipeInput = z.input<typeof recipeSchema>;
export type ValidatedRecipe = z.output<typeof recipeSchema>;
