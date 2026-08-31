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

/**
 * Rejects a second line with the same normalised name rather than silently
 * dropping it — the form marks the offending row with the same message
 * (recipe-form.tsx), so this is the server keeping that promise rather than
 * quietly losing what the user typed.
 */
function rejectDuplicateNames(lines: { name: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (seen.has(line.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Staat al in dit recept",
        path: [index, "name"],
      });
    }
    seen.add(line.name);
  });
}

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "Titel is vereist").max(80, "Titel mag maximaal 80 tekens zijn"),
  instructions: z.string().max(5000, "Bereiding mag maximaal 5000 karakters zijn"),
  ingredients: z
    .array(ingredientLineSchema)
    .min(1, "Voeg minstens 1 ingrediënt toe")
    .superRefine(rejectDuplicateNames),
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
