// The ingredient rows as the recipe form holds them — three text fields per
// row — and the two translations across that edge: a saved recipe into rows
// the form can edit, and typed rows back into the lines the schema accepts.
// Pure, so the row-level rules (an unparseable quantity, a name repeated from
// an earlier row) are unit-tested without rendering the form; the component
// only has to pin each reported error onto its row.

import { parseQuantity } from "@/src/lib/recepten/quantity-input";
import type { RecipeIngredientView } from "@/src/lib/recepten/view";

export type IngredientFormLine = { name: string; quantity: string; unit: string };

export type RecipeFormValues = {
  title: string;
  instructions: string;
  ingredients: IngredientFormLine[];
};

export type IngredientLineError = {
  index: number;
  field: "name" | "quantity";
  message: string;
};

export function emptyLine(): IngredientFormLine {
  return { name: "", quantity: "", unit: "" };
}

/** Prefills the editor; a recipe with no lines still gets one blank row to type into. */
export function toFormLines(ingredients: RecipeIngredientView[]): IngredientFormLine[] {
  if (ingredients.length === 0) return [emptyLine()];
  return ingredients.map((line) => ({
    name: line.name,
    quantity: line.quantity === null ? "" : String(line.quantity).replace(".", ","),
    unit: line.unit ?? "",
  }));
}

/**
 * Only rows with a name typed in count — an untouched blank row is dropped, so
 * the "+ Ingrediënt" row someone opened and abandoned never blocks the save.
 * Every error is reported against the row it belongs to rather than the first
 * one found, so all offending rows light up at once (B1, B3).
 */
export function parseIngredientLines(lines: IngredientFormLine[]): {
  ingredients: RecipeIngredientView[];
  errors: IngredientLineError[];
} {
  const seenNames = new Set<string>();
  const ingredients: RecipeIngredientView[] = [];
  const errors: IngredientLineError[] = [];

  lines.forEach((line, index) => {
    if (line.name.trim() === "") return;

    const parsedQuantity = parseQuantity(line.quantity);
    if (!parsedQuantity.ok) {
      errors.push({ index, field: "quantity", message: "Hoeveelheid moet een getal zijn" });
    }

    const normalizedName = line.name.trim().toLowerCase();
    if (seenNames.has(normalizedName)) {
      errors.push({ index, field: "name", message: "Staat al in dit recept" });
    }
    seenNames.add(normalizedName);

    ingredients.push({
      name: line.name,
      quantity: parsedQuantity.ok ? parsedQuantity.value : null,
      unit: line.unit.trim() === "" ? null : line.unit,
    });
  });

  return { ingredients, errors };
}
