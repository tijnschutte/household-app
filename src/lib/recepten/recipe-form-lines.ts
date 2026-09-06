// The ingredient entry row of the recipe form — three text fields — and the
// one translation across that edge: a typed draft into the line the schema
// accepts, or the reason it cannot be. Pure, so the row-level rules (an
// unparseable quantity, a name already on the recipe) are unit-tested without
// rendering the form; the component only has to show the error it is handed.

import { parseQuantity } from "@/src/lib/recepten/quantity-input";
import { canonicalUnit } from "@/src/lib/recepten/units";
import type { RecipeIngredientView } from "@/src/lib/recepten/view";

export type IngredientDraft = { name: string; quantity: string; unit: string };

export type DraftError = { field: "name" | "quantity"; message: string };

export type DraftResult =
  { ok: true; line: RecipeIngredientView } | { ok: false; error: DraftError };

/**
 * The step rows as the editor holds them: exactly one blank row at the end,
 * whatever was typed or removed. That row is where the next step is typed;
 * the schema drops it when it stays empty.
 */
export function withTrailingBlank(steps: string[]): string[] {
  const trimmedEnd = [...steps];
  while (trimmedEnd.length > 0 && trimmedEnd[trimmedEnd.length - 1] === "") trimmedEnd.pop();
  return [...trimmedEnd, ""];
}

export function emptyDraft(): IngredientDraft {
  return { name: "", quantity: "", unit: "" };
}

/**
 * Names are compared the way the schema and the database compare them,
 * trimmed and lowercased, so "Ui" cannot be added beside "ui" only to be
 * refused on save.
 */
export function parseDraft(draft: IngredientDraft, existing: RecipeIngredientView[]): DraftResult {
  const name = draft.name.trim().toLowerCase();
  if (name === "") {
    return { ok: false, error: { field: "name", message: "Naam is vereist" } };
  }
  if (existing.some((line) => line.name.trim().toLowerCase() === name)) {
    return { ok: false, error: { field: "name", message: "Staat al in dit recept" } };
  }

  const quantity = parseQuantity(draft.quantity);
  if (!quantity.ok) {
    return {
      ok: false,
      error: { field: "quantity", message: "Hoeveelheid moet een getal zijn" },
    };
  }

  return { ok: true, line: { name, quantity: quantity.value, unit: canonicalUnit(draft.unit) } };
}
