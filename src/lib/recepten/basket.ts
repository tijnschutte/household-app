// The merge rule for "In mandje": how a recipe's ingredient lines combine with
// whatever is already on the shared list. Pure and unit-tested — the write
// itself (recepten/actions.ts) only has to run what this decides, inside one
// transaction, and the sheet on the recipe screen shows the same decision per
// line before anything is written, so the preview cannot disagree with the
// write.

/** One ingredient line off a recipe, ready to land on the list. */
export type BasketLine = { name: string; quantity: number | null; unit: string | null };

/** The subset of a Grocery row this merge needs to decide anything. */
export type ListRow = {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  bought: boolean;
};

export type ListRowUpdate = {
  id: number;
  quantity: number | null;
  unit: string | null;
  bought: boolean;
};

export type ListMerge = { create: BasketLine[]; update: ListRowUpdate[] };

/**
 * What one line does to the list.
 *
 * - `create`: not on the list yet.
 * - `sum`: on the list, not bought, same unit (null counts as the same unit) —
 *   the quantities add up to `quantity`.
 * - `restore`: on the list and bought — un-bought, with the line's own
 *   quantity/unit. This is a fresh trip, not a top-up of the one just finished.
 * - `skip`: on the list, not bought, different unit. There is no shared
 *   quantity to add ("2 stuks" plus "200 gram" is not one number), and
 *   refusing the whole action over one line would be worse than skipping it.
 */
export type MergeOutcome =
  | { kind: "create" }
  | { kind: "sum"; row: ListRow; quantity: number | null }
  | { kind: "restore"; row: ListRow }
  | { kind: "skip"; row: ListRow };

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** null stands for "no quantity specified" rather than zero, so it is the other side's identity. */
function sumQuantity(existing: number | null, added: number | null): number | null {
  if (existing === null) return added;
  if (added === null) return existing;
  return existing + added;
}

export function mergeOutcome(line: BasketLine, existingRows: ListRow[]): MergeOutcome {
  const key = normalize(line.name);
  const row = existingRows.find((candidate) => normalize(candidate.name) === key);

  if (!row) return { kind: "create" };
  if (row.bought) return { kind: "restore", row };
  if (row.unit !== line.unit) return { kind: "skip", row };
  return { kind: "sum", row, quantity: sumQuantity(row.quantity, line.quantity) };
}

/** Decides what a recipe's ingredient lines do to the rows already on a list. */
export function mergeIntoList(lines: BasketLine[], existingRows: ListRow[]): ListMerge {
  const create: BasketLine[] = [];
  const update: ListRowUpdate[] = [];

  for (const line of lines) {
    const outcome = mergeOutcome(line, existingRows);
    switch (outcome.kind) {
      case "create":
        create.push(line);
        break;
      case "sum":
        update.push({
          id: outcome.row.id,
          quantity: outcome.quantity,
          unit: outcome.row.unit,
          bought: false,
        });
        break;
      case "restore":
        update.push({
          id: outcome.row.id,
          quantity: line.quantity,
          unit: line.unit,
          bought: false,
        });
        break;
      case "skip":
        break;
    }
  }

  return { create, update };
}

/**
 * "In mandje" in the past tense: every one of these ingredients is on the list
 * and not yet bought. Shown on the list screen and on the recipe's button.
 */
export function allOnList(names: string[], existingRows: ListRow[]): boolean {
  const unbought = new Set(
    existingRows.flatMap((row) => (row.bought ? [] : [normalize(row.name)]))
  );
  return names.every((name) => unbought.has(normalize(name)));
}
