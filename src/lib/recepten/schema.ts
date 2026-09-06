import { z } from "zod";
import { canonicalUnit } from "@/src/lib/recepten/units";

/**
 * What the server accepts for a recipe: title, steps, at least one ingredient
 * line, and any number of tags. Shared by the form (client-side safeParse,
 * mirroring signUpSchema's pattern) and the action that writes it.
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
  .nullable()
  .transform(canonicalUnit);

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
 * dropping it — the form refuses the same line when it is typed
 * (recipe-form-lines.ts), so this is the server keeping that promise rather
 * than quietly losing what the user typed.
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

export const MAX_STEPS = 50;
export const MAX_STEP_LENGTH = 1000;

/**
 * A blank step is dropped rather than rejected: the form always offers one
 * empty row to type the next step into, and leaving it empty is how someone
 * says they are done.
 */
const stepsSchema = z
  .array(z.string().trim().max(MAX_STEP_LENGTH, "Een stap mag maximaal 1000 tekens zijn"))
  .transform((steps) => steps.filter((step) => step !== ""))
  .pipe(z.array(z.string()).max(MAX_STEPS, "Maximaal 50 stappen"));

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "Titel is vereist").max(80, "Titel mag maximaal 80 tekens zijn"),
  steps: stepsSchema,
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
