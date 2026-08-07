// How the boodschappenlijst is ordered and grouped on screen. Pure, so the
// rule can be read and tested without rendering a 700-line component.

/**
 * The fields the ordering depends on; a Prisma Grocery row satisfies this.
 * `bought` is nullable in the schema, and a null means not bought.
 */
export type OrderableItem = {
  bought: boolean | null;
  updatedAt: Date | string;
};

export type CategorizedItem = OrderableItem & { categoryId: number | null };

export type ItemGroup<T> = {
  /** Unchecked first in their existing order, then checked, newest check first. */
  items: T[];
  /** What is still left to buy — the header count, not `items.length`. */
  uncheckedCount: number;
};

/**
 * Checked items stay inside their own category group rather than moving to a
 * "done" pile: within a group, unchecked items keep the order they came in,
 * and checked items sink below, most-recently-checked first.
 */
export function sortGroup<T extends OrderableItem>(items: readonly T[]): ItemGroup<T> {
  const unchecked = items.filter((item) => !item.bought);
  const checked = items
    .filter((item) => item.bought)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { items: [...unchecked, ...checked], uncheckedCount: unchecked.length };
}

/**
 * Splits the list into the uncategorized group and one group per category.
 *
 * Every category is returned even when it holds nothing, because an empty
 * category is still a drop target — and a fully checked one is not empty.
 */
export function groupByCategory<T extends CategorizedItem, C extends { id: number }>(
  items: readonly T[],
  categories: readonly C[]
): {
  uncategorized: ItemGroup<T>;
  categorized: Array<{ category: C } & ItemGroup<T>>;
} {
  return {
    uncategorized: sortGroup(items.filter((item) => !item.categoryId)),
    categorized: categories.map((category) => ({
      category,
      ...sortGroup(items.filter((item) => item.categoryId === category.id)),
    })),
  };
}
