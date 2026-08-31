// The boodschappenlijst as the home screen holds it, and the transforms it
// applies optimistically before the server has confirmed anything. Pure, so
// what an optimistic update actually does can be read and tested without
// rendering the page it happens on.

import type { Grocery, Category } from "@prisma/client";

// `quantity` crosses the server/client boundary as a plain number, never a
// Prisma Decimal: only data.ts and actions.ts touch the database type, and
// they convert before a row ever reaches a client component (see
// house/data.ts and house/actions.ts).
export type GroceryWithCategory = Omit<Grocery, "quantity" | "sourceRecipeId"> & {
  quantity: number | null;
  category: Category | null;
  /** The recipe that last stamped this row's quantity, for "van {recept}" — null for a hand-typed row. */
  sourceRecipeTitle: string | null;
};

/**
 * Which of the two lists is on screen. The word for it, so the UI never has to
 * carry a bare boolean and remember which way round `true` means.
 */
export type ViewKey = "household" | "personal";

/** One of the two lists (household or personal) as it is currently shown. */
export type ViewData = {
  items: GroceryWithCategory[];
  categories: Category[];
};

export const MAX_ITEM_NAME_LENGTH = 30;

export type ItemName = { ok: true; name: string } | { ok: false; message: string };

/**
 * What the add bar accepts. The server lowercases names so duplicates collapse
 * regardless of typing; doing it here too keeps the optimistic row identical to
 * the one the next poll returns.
 */
export function parseItemName(raw: string): ItemName {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Voer een itemnaam in" };
  }
  if (trimmed.length > MAX_ITEM_NAME_LENGTH) {
    return { ok: false, message: `Itemnaam mag maximaal ${MAX_ITEM_NAME_LENGTH} karakters zijn` };
  }
  return { ok: true, name: trimmed.toLowerCase() };
}

function mapItems(
  data: ViewData,
  id: number,
  change: (item: GroceryWithCategory) => GroceryWithCategory
): ViewData {
  return {
    ...data,
    items: data.items.map((item) => (item.id === id ? change(item) : item)),
  };
}

export function setItemBought(data: ViewData, id: number, bought: boolean): ViewData {
  return mapItems(data, id, (item) => ({ ...item, bought }));
}

export function renameItem(data: ViewData, id: number, name: string): ViewData {
  return mapItems(data, id, (item) => ({ ...item, name }));
}

export function moveItemToCategory(
  data: ViewData,
  id: number,
  category: Category | null
): ViewData {
  return mapItems(data, id, (item) => ({ ...item, categoryId: category?.id ?? null, category }));
}

/** Swaps the optimistic row for the one the server actually created. */
export function replaceItem(
  data: ViewData,
  id: number,
  replacement: GroceryWithCategory
): ViewData {
  return mapItems(data, id, () => replacement);
}

export function appendItem(data: ViewData, item: GroceryWithCategory): ViewData {
  return { ...data, items: [...data.items, item] };
}

export function removeItems(data: ViewData, ids: readonly number[]): ViewData {
  const removed = new Set(ids);
  return { ...data, items: data.items.filter((item) => !removed.has(item.id)) };
}

export function appendCategory(data: ViewData, category: Category): ViewData {
  return { ...data, categories: [...data.categories, category] };
}

/**
 * Deleting a category never deletes what was filed under it: those items fall
 * back to uncategorized, matching what the server does to the rows.
 */
export function removeCategory(data: ViewData, categoryId: number): ViewData {
  return {
    items: data.items.map((item) =>
      item.categoryId === categoryId ? { ...item, categoryId: null, category: null } : item
    ),
    categories: data.categories.filter((category) => category.id !== categoryId),
  };
}

/** What restoring a deleted item needs; `personal` mirrors createGroceryItem's flag. */
export type RestoreSnapshot = {
  name: string;
  categoryId: number | null;
  personal: boolean;
  bought?: boolean;
  quantity: number | null;
  unit: string | null;
};

export function snapshotForRestore(item: GroceryWithCategory): RestoreSnapshot {
  return {
    name: item.name,
    categoryId: item.categoryId,
    personal: item.userId !== null,
    quantity: item.quantity,
    unit: item.unit,
    bought: item.bought ?? false,
  };
}

/** A negative id marks an optimistic row whose create is still in flight. */
export function isOptimistic(id: number): boolean {
  return id < 0;
}
