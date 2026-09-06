import type { Category, Grocery } from "@prisma/client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/src/lib/action-result";
import {
  appendItem,
  isOptimistic,
  moveItemToCategory,
  parseItemName,
  removeCategory,
  removeItems,
  renameItem as renameItemIn,
  replaceItem,
  setItemBought,
  snapshotForRestore,
  type GroceryWithCategory,
  type RestoreSnapshot,
  type ViewKey,
} from "@/src/lib/house/grocery-view";
import type { GroceryViews } from "./use-grocery-views";

/**
 * Every write the list makes, handed down from the server page. Owned here so
 * the page can hand fakes in from a test.
 */
export type GroceryEditActions = {
  onCreateItem: (
    name: string,
    view: ViewKey,
    categoryId?: number | null
  ) => Promise<ActionResult<Omit<Grocery, "quantity"> & { quantity: number | null }>>;
  onSetBought: (groceryId: number, bought: boolean) => Promise<unknown>;
  onDeleteItems: (ids: number[]) => Promise<unknown>;
  onRestoreItems: (items: RestoreSnapshot[]) => Promise<unknown>;
  onUpdateItemCategory: (groceryId: number, categoryId: number | null) => Promise<unknown>;
  onRenameItem: (groceryId: number, name: string) => Promise<ActionResult>;
  onDeleteCategory: (categoryId: number) => Promise<unknown>;
};

export type GroceryEdits = {
  toggleBought: (groceryId: number, bought: boolean) => Promise<void>;
  /** Delete every checked item, with an undo toast. */
  clearBought: () => Promise<void>;
  isClearingBought: boolean;
  /** `name` has already been through parseItemName; `category` is where it lands. */
  add: (name: string, category: Category | null) => Promise<void>;
  moveToCategory: (groceryId: number, categoryId: number | null) => Promise<void>;
  deleteCategory: (categoryId: number) => Promise<void>;
  /** Swipe-to-delete on one row, with the same undo toast as clearing. */
  deleteItem: (groceryId: number) => Promise<void>;
  rename: (groceryId: number, newName: string) => Promise<void>;
};

/**
 * The edits the visible list accepts. Each one is applied locally first and
 * told to the server second, then put back (with a toast) when the server
 * refuses — so the screen never waits on the network, and never disagrees with
 * the server for longer than one round trip.
 */
export function useGroceryEdits(
  householdId: number,
  views: GroceryViews,
  actions: GroceryEditActions
): GroceryEdits {
  const [isClearingBought, setIsClearingBought] = useState(false);
  // Counts down so each optimistic add gets a unique temp id that can never
  // collide with a real (positive) database id.
  const tempIdRef = useRef(-1);

  const undoToast = (message: string, snapshot: RestoreSnapshot[]) =>
    toast.success(message, {
      action: {
        label: "Ongedaan maken",
        onClick: async () => {
          try {
            await actions.onRestoreItems(snapshot);
            views.refresh();
          } catch (error) {
            console.error("Failed to restore items:", error);
            toast.error("Herstellen mislukt");
          }
        },
      },
    });

  const toggleBought = async (groceryId: number, bought: boolean) => {
    // Deliberately doesn't mark the list busy — this is a quick, low-risk
    // mutation, not a multi-step drag/edit that a poll refresh could clobber.
    views.update((data) => setItemBought(data, groceryId, bought));

    try {
      await actions.onSetBought(groceryId, bought);
    } catch (error) {
      views.update((data) => setItemBought(data, groceryId, !bought));
      console.error("Failed to update bought state:", error);
      toast.error("Bijwerken mislukt");
    }
  };

  const clearBought = async () => {
    const boughtItems = views.items.filter((item) => item.bought);
    if (boughtItems.length === 0) return;

    setIsClearingBought(true);
    const restoreSnapshot = boughtItems.map(snapshotForRestore);
    const ids = boughtItems.map((item) => item.id);

    try {
      await actions.onDeleteItems(ids);
      views.update((data) => removeItems(data, ids));
      undoToast(`${ids.length} item${ids.length === 1 ? "" : "s"} verwijderd`, restoreSnapshot);
    } catch (error) {
      console.error("Error clearing bought items:", error);
      toast.error("Verwijderen mislukt");
    } finally {
      setIsClearingBought(false);
    }
  };

  const add = async (name: string, category: Category | null) => {
    // Optimistic insert: a temp item (negative id) appears immediately and is
    // reconciled with (or rolled back to) the server afterwards. It carries
    // the chosen category so it renders inside that group right away.
    const tempId = tempIdRef.current--;
    const optimisticItem: GroceryWithCategory = {
      id: tempId,
      name,
      // A hand-typed item never carries a quantity or unit; those only arrive
      // with an item added from a recipe (recepten/actions.ts).
      quantity: null,
      unit: null,
      bought: false,
      householdId: views.view === "personal" ? null : householdId,
      userId: null,
      categoryId: category?.id ?? null,
      category,
      // A hand-typed item never traces back to a recipe.
      sourceRecipeTitle: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    views.update((data) => appendItem(data, optimisticItem));

    try {
      const result = await actions.onCreateItem(name, views.view, category?.id ?? null);

      // "Brood staat al in je lijst" arrives here, as a value. Thrown, its
      // message would be redacted in production and the user would read a
      // paragraph about Server Components instead.
      if (!result.success) {
        toast.error(result.message);
        views.update((data) => removeItems(data, [tempId]));
        return;
      }

      views.update((data) =>
        replaceItem(data, tempId, { ...result.value, category, sourceRecipeTitle: null })
      );
    } catch (error) {
      console.error("Failed to create grocery item:", error);
      toast.error("Toevoegen mislukt");
      views.update((data) => removeItems(data, [tempId]));
    }
  };

  const moveToCategory = async (groceryId: number, categoryId: number | null) => {
    const currentItem = views.items.find((item) => item.id === groceryId);
    if (!currentItem) return;
    // Dropped back where it came from: nothing to save, nothing to say.
    if (currentItem.categoryId === categoryId) return;

    const previousCategory = currentItem.category;
    const targetCategory = views.categories.find((c) => c.id === categoryId) ?? null;
    views.update((data) => moveItemToCategory(data, groceryId, targetCategory));

    try {
      await actions.onUpdateItemCategory(groceryId, categoryId);
    } catch (error) {
      views.update((data) => moveItemToCategory(data, groceryId, previousCategory));
      console.error("Failed to update category:", error);
      toast.error("Verplaatsen mislukt");
    }
  };

  const deleteCategory = async (categoryId: number) => {
    try {
      await actions.onDeleteCategory(categoryId);
      views.update((data) => removeCategory(data, categoryId));
      toast.success("Categorie verwijderd");
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Verwijderen categorie mislukt");
    }
  };

  const deleteItem = async (groceryId: number) => {
    // An optimistic temp item's create is still in flight; there is no server
    // row to delete yet.
    if (isOptimistic(groceryId)) return;
    const item = views.items.find((i) => i.id === groceryId);
    if (!item) return;

    views.update((data) => removeItems(data, [groceryId]));

    try {
      await actions.onDeleteItems([groceryId]);
      undoToast(`"${item.name}" verwijderd`, [snapshotForRestore(item)]);
    } catch (error) {
      // Revert: put the item back where it was.
      views.update((data) => ({ ...data, items: [...data.items, item] }));
      console.error("Failed to delete item:", error);
      toast.error("Verwijderen mislukt");
    }
  };

  const rename = async (groceryId: number, newName: string) => {
    // Same rule as the add bar: one definition of what an item may be called,
    // and the normalization it mirrors from the server.
    const parsed = parseItemName(newName);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    const normalized = parsed.name;
    try {
      const result = await actions.onRenameItem(groceryId, normalized);

      // Renaming onto a name already on the list is the same collision the
      // add bar can hit, and the user needs the same sentence back.
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      views.update((data) => renameItemIn(data, groceryId, normalized));
      toast.success("Item hernoemd");
    } catch (error) {
      console.error("Failed to rename item:", error);
      toast.error("Hernoemen mislukt");
    }
  };

  return {
    toggleBought,
    clearBought,
    isClearingBought,
    add,
    moveToCategory,
    deleteCategory,
    deleteItem,
    rename,
  };
}
