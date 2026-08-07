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
 * The droppable ids the list registers for its group containers. Declared here
 * beside the function that reads them back, so registration and resolution
 * cannot drift apart.
 */
export const UNCATEGORIZED_DROP_ID = "uncategorized";
const CATEGORY_DROP_PREFIX = "category-";

export function categoryDropId(categoryId: number): string {
  return `${CATEGORY_DROP_PREFIX}${categoryId}`;
}

/**
 * Which category a drop lands in. dnd-kit names whichever droppable was hit:
 * either one of the group containers above, or another item — dropping onto an
 * item means "file this where that item lives".
 */
export function resolveDropCategory(
  overId: string,
  items: readonly { id: number; categoryId: number | null }[]
): number | null {
  if (overId === UNCATEGORIZED_DROP_ID) return null;
  if (overId.startsWith(CATEGORY_DROP_PREFIX)) {
    return parseInt(overId.slice(CATEGORY_DROP_PREFIX.length));
  }
  const target = items.find((item) => item.id === parseInt(overId));
  return target?.categoryId ?? null;
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
