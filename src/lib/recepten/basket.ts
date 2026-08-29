// The merge rule for "In mandje": how a recipe's ingredient lines combine with
// whatever is already on the shared list. Pure and unit-tested — the write
// itself (recepten/actions.ts) only has to run what this decides, inside one
// transaction, so the rule can be proven without a database.

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

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** null stands for "no quantity specified" rather than zero, so it is the other side's identity. */
function sumQuantity(existing: number | null, added: number | null): number | null {
  if (existing === null) return added;
  if (added === null) return existing;
  return existing + added;
}

/**
 * Decides what a recipe's ingredient lines do to the rows already on a list.
 *
 * - Not on the list: create it.
 * - On the list, not bought, same unit (null counts as the same unit): sum
 *   the quantities.
 * - On the list and bought: un-bought, with the line's own quantity/unit —
 *   this is a fresh trip, not a top-up of the one just finished.
 * - On the list, not bought, different unit: left alone. There is no shared
 *   quantity to add ("2 stuks" plus "200 gram" is not one number), and
 *   refusing the whole action over one line would be worse than skipping it.
 */
export function mergeIntoList(lines: BasketLine[], existingRows: ListRow[]): ListMerge {
  const create: BasketLine[] = [];
  const update: ListRowUpdate[] = [];

  for (const line of lines) {
    const key = normalize(line.name);
    const existing = existingRows.find((row) => normalize(row.name) === key);

    if (!existing) {
      create.push(line);
      continue;
    }

    if (existing.bought) {
      update.push({ id: existing.id, quantity: line.quantity, unit: line.unit, bought: false });
      continue;
    }

    if (existing.unit !== line.unit) {
      continue;
    }

    update.push({
      id: existing.id,
      quantity: sumQuantity(existing.quantity, line.quantity),
      unit: existing.unit,
      bought: false,
    });
  }

  return { create, update };
}
