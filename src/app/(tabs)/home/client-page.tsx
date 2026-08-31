"use client";

import { Grocery } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { User, House, Plus, Tag, Loader2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/src/components/ui/select";
import {
  appendCategory,
  appendItem,
  isOptimistic,
  MAX_ITEM_NAME_LENGTH,
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
  type ViewData,
  type ViewKey,
} from "@/src/lib/house/grocery-view";
import GroceryList from "@/src/components/house/grocery-list";
import AddCategory, { type AddCategoryActions } from "@/src/components/add-category";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import { toast } from "sonner";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * Everything the home screen can do, handed down from the server page in one
 * prop. Reading the list is here too: getHomeData is a server action like the
 * rest, and the page polls it. Keeps Prisma out of anything that renders this.
 */
export type HomeActions = {
  onLoadData: (view: ViewKey) => Promise<ViewData>;
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
} & AddCategoryActions;

type HouseholdClientPageProps = {
  /**
   * Only the id: the full row carries `secret`, the household's join code, and
   * a prop is serialized into the RSC payload whether the client reads it or
   * not. Nothing on this screen displays it.
   */
  householdId: number;
  initialData: ViewData;
  actions: HomeActions;
};

// Compact 2-segment control replacing the old footer toggle buttons: one
// rounded track, a sliding active pill, icon + Dutch label per segment.
// It's navigation (which list you're looking at), not an action, so it
// lives under the header rather than competing with the add bar.
function ViewToggle({ view, onToggle }: { view: ViewKey; onToggle: (view: ViewKey) => void }) {
  const isPersonal = view === "personal";
  return (
    <div
      role="tablist"
      aria-label="Lijst weergave"
      className="relative flex w-full rounded-lg bg-secondary p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: isPersonal ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={!isPersonal}
        onClick={() => onToggle("household")}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
          !isPersonal ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <House className="w-4 h-4" />
        Huishouden
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isPersonal}
        onClick={() => onToggle("personal")}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
          isPersonal ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <User className="w-4 h-4" />
        Persoonlijk
      </button>
    </div>
  );
}

export default function HouseholdClientPage({
  householdId,
  initialData,
  actions,
}: HouseholdClientPageProps) {
  // Both views are cached independently so toggling back and forth is instant
  // after the first visit. The household view is seeded server-side.
  const [dataByView, setDataByView] = useState<Record<ViewKey, ViewData | null>>({
    household: initialData,
    personal: null,
  });
  const [view, setView] = useState<ViewKey>("household");
  const [itemName, setItemName] = useState("");
  const [isClearingBought, setIsClearingBought] = useState(false);
  // The category new items land in ("quick add with category"). Sticky across
  // consecutive adds; reset to "Geen categorie" (null) when switching lists.
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
  // The add-bar picker's "+ Nieuwe categorie" option is the one place to
  // create categories; it opens this controlled dialog.
  const [pickerAddOpen, setPickerAddOpen] = useState(false);
  // Which of the two inputs the picker hands the caret to as it closes. A ref,
  // not `pickerAddOpen`: Radix fires close-autofocus from a handler captured a
  // render earlier, so the state it would read is still the pre-choice one.
  const dialogWantsCaretRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The <main> element is the actual scrolling container (overflow-y-auto);
  // scrolled to bottom only after the current user adds an item.
  const mainRef = useRef<HTMLElement>(null);
  // Flipped by GroceryList while a drag or inline rename is in progress, so a
  // silent poll refresh can't clobber an in-flight edit.
  const busyRef = useRef(false);
  // Counts down so each optimistic add gets a unique temp id that can never
  // collide with a real (positive) database id.
  const tempIdRef = useRef(-1);

  const currentView = dataByView[view];
  const groceryList = currentView?.items ?? [];
  const categories = currentView?.categories ?? [];
  const isLoading = currentView === null;
  // Resolved against the visible view's categories, so a category that was
  // deleted (locally or by a poll refresh) silently falls back to
  // "Geen categorie" instead of pointing at a stale id.
  const targetCategory = categories.find((c) => c.id === targetCategoryId) ?? null;
  // Drives the "n in je mandje / Wissen" bar docked above the add-bar
  // (WP-10): checked items stay visible in place, so clearing them is a
  // deliberate, separate action rather than tucked inside a collapsed section.
  const boughtCount = groceryList.filter((item) => item.bought).length;

  const fetchData = useCallback(
    async (view: ViewKey, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        const data = await actions.onLoadData(view);

        // A poll finished while the user is mid-drag/mid-rename: don't clobber it.
        if (silent && busyRef.current) return;

        setDataByView((prev) => {
          const existing = prev[view];
          // Avoid a pointless re-render when nothing actually changed.
          if (existing && JSON.stringify(existing) === JSON.stringify(data)) {
            return prev;
          }
          return { ...prev, [view]: data };
        });
      } catch (error) {
        console.error("Failed to fetch data:", error);
        if (!silent) toast.error("Laden van gegevens mislukt");
      }
    },
    [actions]
  );

  // Real-time sync: poll every 10s + refetch on tab focus, for the currently visible view only.
  useEffect(() => {
    const interval = setInterval(() => fetchData(view, { silent: true }), 10000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(view, { silent: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData, view]);

  const handleToggleView = (next: ViewKey) => {
    setView(next);
    // The target category belongs to the previously visible list; the other
    // list has its own categories, so reset to "Geen categorie".
    setTargetCategoryId(null);
    if (dataByView[next] === null) {
      fetchData(next);
    }
  };

  const updateView = (key: ViewKey, updater: (data: ViewData) => ViewData) => {
    setDataByView((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return { ...prev, [key]: updater(current) };
    });
  };

  const handleToggleBought = async (groceryId: number, bought: boolean) => {
    // Optimistic toggle: flip locally right away, revert + error toast on failure.
    // Deliberately doesn't touch busyRef — this is a quick, low-risk mutation,
    // not a multi-step drag/edit that a poll refresh could clobber badly.
    updateView(view, (data) => setItemBought(data, groceryId, bought));

    try {
      await actions.onSetBought(groceryId, bought);
    } catch (error) {
      updateView(view, (data) => setItemBought(data, groceryId, !bought));
      console.error("Failed to update bought state:", error);
      toast.error("Bijwerken mislukt");
    }
  };

  const handleClearBought = async () => {
    const boughtItems = groceryList.filter((item) => item.bought);
    if (boughtItems.length === 0) return;

    setIsClearingBought(true);
    const restoreSnapshot = boughtItems.map(snapshotForRestore);
    const ids = boughtItems.map((item) => item.id);

    try {
      await actions.onDeleteItems(ids);
      updateView(view, (data) => removeItems(data, ids));
      toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} verwijderd`, {
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            try {
              await actions.onRestoreItems(restoreSnapshot);
              fetchData(view);
            } catch (error) {
              console.error("Failed to restore items:", error);
              toast.error("Herstellen mislukt");
            }
          },
        },
      });
    } catch (error) {
      console.error("Error clearing bought items:", error);
      toast.error("Verwijderen mislukt");
    } finally {
      setIsClearingBought(false);
    }
  };

  const addItem = async () => {
    const parsed = parseItemName(itemName);
    if (!parsed.ok) {
      toast.error(parsed.message);
      inputRef.current?.focus();
      return;
    }
    const trimmedName = parsed.name;

    // Snapshot the resolved target category now, so a mid-flight chip change
    // or category deletion can't make the optimistic item and the server row
    // disagree about where the item landed.
    const addCategory = targetCategory;

    // Optimistic insert: a temp item (negative id) appears immediately, the
    // input clears and stays enabled so the user can keep typing the next
    // item, and we reconcile with (or roll back to) the server afterwards.
    // The temp item carries the chosen category so it renders inside that
    // category's group right away.
    const tempId = tempIdRef.current--;
    const optimisticItem: GroceryWithCategory = {
      id: tempId,
      name: trimmedName,
      // A hand-typed item never carries a quantity or unit; those only arrive
      // with an item added from a recipe (recepten/actions.ts).
      quantity: null,
      unit: null,
      bought: false,
      householdId: view === "personal" ? null : householdId,
      userId: null,
      categoryId: addCategory?.id ?? null,
      category: addCategory,
      // A hand-typed item never traces back to a recipe.
      sourceRecipeTitle: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    updateView(view, (data) => appendItem(data, optimisticItem));
    setItemName("");
    inputRef.current?.focus();
    // Scroll the actual scrolling element (the <main> content area, not the
    // list's own div) to the bottom now that the user added an item.
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
    });

    try {
      const result = await actions.onCreateItem(trimmedName, view, addCategory?.id ?? null);

      // "Brood staat al in je lijst" arrives here, as a value. Thrown, its
      // message would be redacted in production and the user would read a
      // paragraph about Server Components instead.
      if (!result.success) {
        toast.error(result.message);
        updateView(view, (data) => removeItems(data, [tempId]));
        return;
      }

      updateView(view, (data) =>
        replaceItem(data, tempId, {
          ...result.value,
          category: addCategory,
          sourceRecipeTitle: null,
        })
      );
    } catch (error) {
      console.error("Failed to create grocery item:", error);
      toast.error("Toevoegen mislukt");
      updateView(view, (data) => removeItems(data, [tempId]));
    }
  };

  const handleDragEnd = async (groceryId: number, categoryId: number | null) => {
    // Find the current item to check if category actually changed
    const currentItem = groceryList.find((item) => item.id === groceryId);
    if (!currentItem) return;

    // Check if category actually changed
    const categoryChanged = currentItem.categoryId !== categoryId;
    if (!categoryChanged) return; // Don't update or show toast if nothing changed

    const previousCategory = currentItem.category;

    // Optimistic update - update local state immediately
    const targetCategory = categories.find((c) => c.id === categoryId) || null;
    updateView(view, (data) => moveItemToCategory(data, groceryId, targetCategory));

    try {
      await actions.onUpdateItemCategory(groceryId, categoryId);
    } catch (error) {
      updateView(view, (data) => moveItemToCategory(data, groceryId, previousCategory));
      console.error("Failed to update category:", error);
      toast.error("Verplaatsen mislukt");
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await actions.onDeleteCategory(categoryId);
      updateView(view, (data) => removeCategory(data, categoryId));
      toast.success("Categorie verwijderd");
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Verwijderen categorie mislukt");
    }
  };

  // "+" on a category section header: pre-target that category in the add-bar
  // chip and focus the one shared input (no per-category inputs).
  const handleAddToCategory = (categoryId: number) => {
    setTargetCategoryId(categoryId);
    inputRef.current?.focus();
  };

  // Swipe-to-delete: remove a single item optimistically, with the same
  // undo-toast pattern as clearing the Afgevinkt section.
  const handleDeleteItem = async (groceryId: number) => {
    // An optimistic temp item's create is still in flight; there is no server
    // row to delete yet.
    if (isOptimistic(groceryId)) return;
    const item = groceryList.find((i) => i.id === groceryId);
    if (!item) return;

    const restoreSnapshot = [snapshotForRestore(item)];

    updateView(view, (data) => removeItems(data, [groceryId]));

    try {
      await actions.onDeleteItems([groceryId]);
      toast.success(`"${item.name}" verwijderd`, {
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            try {
              await actions.onRestoreItems(restoreSnapshot);
              fetchData(view);
            } catch (error) {
              console.error("Failed to restore item:", error);
              toast.error("Herstellen mislukt");
            }
          },
        },
      });
    } catch (error) {
      // Revert: put the item back where it was.
      updateView(view, (data) => ({ ...data, items: [...data.items, item] }));
      console.error("Failed to delete item:", error);
      toast.error("Verwijderen mislukt");
    }
  };

  const handleRenameItem = async (groceryId: number, newName: string) => {
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

      updateView(view, (data) => renameItemIn(data, groceryId, normalized));
      toast.success("Item hernoemd");
    } catch (error) {
      console.error("Failed to rename item:", error);
      toast.error("Hernoemen mislukt");
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Fixed title matching the tab label; which list is visible is the
          toggle's job, and the household name lives on the Huis page. */}
      <PageHeader title="Mandje" left={<HuisButton />} />

      {/* List-view toggle directly under the header: it's navigation (which
          list you're looking at), kept away from the footer now that the
          platform tab bar lives down there too. */}
      <div className="w-full max-w-2xl mx-auto shrink-0 px-4 pt-3">
        <ViewToggle view={view} onToggle={handleToggleView} />
      </div>

      {/* Main scrollable content area */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 pt-4 pb-6"
      >
        <GroceryList
          groceryList={groceryList}
          categories={categories}
          isLoading={isLoading}
          onToggleBought={handleToggleBought}
          onDragEnd={handleDragEnd}
          onDeleteCategory={handleDeleteCategory}
          onRenameItem={handleRenameItem}
          onAddToCategory={handleAddToCategory}
          onDeleteItem={handleDeleteItem}
          onBusyChange={(busy) => {
            busyRef.current = busy;
          }}
        />
      </main>

      {/* Footer - Fixed at bottom: an optional clear-all bar, then the add
          bar. The platform tab bar renders below this and owns the iOS
          safe-area inset. */}
      <footer className="w-full shrink-0 border-t border-border bg-background px-4 py-3">
        {/* Clear-all bar (WP-10): checked items stay visible in their
            categories, so this is the one place to bulk-clear them. Only
            shown while at least one item in the current view is checked;
            animates height/opacity in and out. */}
        <div
          className={`mx-auto w-full max-w-2xl overflow-hidden transition-all duration-150 ease-out ${
            boughtCount > 0 ? "mb-2 max-h-12 opacity-100" : "mb-0 max-h-0 opacity-0"
          }`}
        >
          <div className="flex h-10 items-center justify-between rounded-lg bg-secondary px-3">
            <span className="text-sm text-muted-foreground">{boughtCount} in je mandje</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearBought}
              disabled={isClearingBought}
              className="h-8 gap-1.5 px-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isClearingBought && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Wissen
            </Button>
          </div>
        </div>
        <div className="relative flex flex-row justify-center items-center gap-2 w-full max-w-2xl mx-auto">
          <div className="flex flex-1 min-w-0 items-center gap-1 h-12 bg-card rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 transition-colors pl-1.5">
            {/* Category chip: where the next added item lands. Sticky across
                consecutive adds; resets when switching lists. */}
            <Select
              value={targetCategory ? String(targetCategory.id) : "none"}
              onValueChange={(value) => {
                if (value === "new") {
                  dialogWantsCaretRef.current = true;
                  setPickerAddOpen(true);
                  return;
                }
                setTargetCategoryId(value === "none" ? null : Number(value));
              }}
            >
              {/* Compact chip: icon + chevron only while no category is
                  targeted; a short truncated name (max 35% of the bar) once
                  one is. The input keeps the majority of the row. */}
              <SelectTrigger
                aria-label="Categorie voor nieuwe items"
                className={
                  targetCategory
                    ? "h-8 max-w-[50%] shrink-0 gap-1 rounded-md border-0 bg-secondary px-2 text-xs font-medium text-muted-foreground shadow-none"
                    : "h-8 w-11 shrink-0 justify-center gap-0.5 rounded-md border-0 bg-secondary px-0 text-muted-foreground shadow-none"
                }
              >
                <Tag className="w-3.5 h-3.5 shrink-0" />
                {targetCategory && <span className="truncate">{targetCategory.name}</span>}
              </SelectTrigger>
              <SelectContent
                side="top"
                align="start"
                sideOffset={10}
                className="min-w-48 rounded-2xl border-border p-1.5 shadow-lg"
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  // "+ Nieuwe categorie" leaves a dialog open on top, and its
                  // name field is what the user is about to type into.
                  if (dialogWantsCaretRef.current) {
                    dialogWantsCaretRef.current = false;
                    return;
                  }
                  // After picking a category, put the caret straight back in
                  // the item input so the user can type the item name.
                  inputRef.current?.focus();
                }}
              >
                <SelectItem value="none" className="rounded-lg py-2.5">
                  Geen categorie
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={String(category.id)}
                    className="rounded-lg py-2.5"
                  >
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value="new" className="rounded-lg py-2.5 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Nieuwe categorie
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <AddCategory
              view={view}
              open={pickerAddOpen}
              onOpenChange={setPickerAddOpen}
              onCreateCategory={actions.onCreateCategory}
              onCategoryAdded={(category) => {
                // Target the fresh category right away (optimistically, so the
                // chip doesn't wait on the refetch) — the user was mid-add.
                updateView(view, (data) => appendCategory(data, category));
                setTargetCategoryId(category.id);
                fetchData(view, { silent: true });
                inputRef.current?.focus();
              }}
            />
            <Input
              ref={inputRef}
              className="flex-1 min-w-0 h-full border-0 shadow-none bg-transparent px-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Voeg een item toe..."
              value={itemName}
              maxLength={MAX_ITEM_NAME_LENGTH}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
          </div>
          <Button
            size="icon"
            aria-label="Item toevoegen"
            onMouseDown={(e) => {
              e.preventDefault();
              addItem();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              addItem();
            }}
            className="h-12 w-12 active:opacity-70"
          >
            <Plus />
          </Button>
        </div>
      </footer>
    </div>
  );
}
