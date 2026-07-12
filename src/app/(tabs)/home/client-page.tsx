"use client";

import { Grocery, Household, Category } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { User, House, Plus, Tag, Loader2 } from "lucide-react";
import { getHomeData } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/src/components/ui/select";
import {
  createGroceryItem,
  deleteItems,
  restoreItems,
  updateGroceryCategory,
  deleteCategory,
  updateGroceryName,
  setGroceryBought,
} from "@/src/lib/actions";
import GroceryList from "@/src/components/house/grocery-list";
import AddCategory from "@/src/components/add-category";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import { toast } from "sonner";

type GroceryWithCategory = Grocery & { category: Category | null };

type ViewData = {
  items: GroceryWithCategory[];
  categories: Category[];
};

type ViewKey = "household" | "personal";

type HouseholdClientPageProps = {
  household: Household;
  initialData: ViewData;
};

// Compact 2-segment control replacing the old footer toggle buttons: one
// rounded track, a sliding active pill, icon + Dutch label per segment.
// It's navigation (which list you're looking at), not an action, so it
// lives under the header rather than competing with the add bar.
function ViewToggle({
  showPersonal,
  onToggle,
}: {
  showPersonal: boolean;
  onToggle: (personal: boolean) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Lijst weergave"
      className="relative flex w-full rounded-lg bg-secondary p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: showPersonal ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={!showPersonal}
        onClick={() => onToggle(false)}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
          !showPersonal ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <House className="w-4 h-4" />
        Huishouden
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={showPersonal}
        onClick={() => onToggle(true)}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
          showPersonal ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <User className="w-4 h-4" />
        Persoonlijk
      </button>
    </div>
  );
}

export default function HouseholdClientPage({ household, initialData }: HouseholdClientPageProps) {
  // Both views are cached independently so toggling back and forth is instant
  // after the first visit. The household view is seeded server-side.
  const [dataByView, setDataByView] = useState<Record<ViewKey, ViewData | null>>({
    household: initialData,
    personal: null,
  });
  const [showPersonal, setShowPersonal] = useState(false);
  const [itemName, setItemName] = useState("");
  const [isClearingBought, setIsClearingBought] = useState(false);
  // The category new items land in ("quick add with category"). Sticky across
  // consecutive adds; reset to "Geen categorie" (null) when switching lists.
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
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

  const viewKey: ViewKey = showPersonal ? "personal" : "household";
  const currentView = dataByView[viewKey];
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

  const fetchData = useCallback(async (view: ViewKey, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      const data = await getHomeData(view === "personal");

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
  }, []);

  // Real-time sync: poll every 10s + refetch on tab focus, for the currently visible view only.
  useEffect(() => {
    const interval = setInterval(() => fetchData(viewKey, { silent: true }), 10000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(viewKey, { silent: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData, viewKey]);

  const handleToggleView = (personal: boolean) => {
    setShowPersonal(personal);
    // The target category belongs to the previously visible list; the other
    // list has its own categories, so reset to "Geen categorie".
    setTargetCategoryId(null);
    const key: ViewKey = personal ? "personal" : "household";
    if (dataByView[key] === null) {
      fetchData(key);
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
    updateView(viewKey, (data) => ({
      ...data,
      items: data.items.map((item) => (item.id === groceryId ? { ...item, bought } : item)),
    }));

    try {
      await setGroceryBought(groceryId, bought);
    } catch (error) {
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.map((item) =>
          item.id === groceryId ? { ...item, bought: !bought } : item
        ),
      }));
      console.error("Failed to update bought state:", error);
      toast.error("Bijwerken mislukt");
    }
  };

  const handleClearBought = async () => {
    const boughtItems = groceryList.filter((item) => item.bought);
    if (boughtItems.length === 0) return;

    setIsClearingBought(true);
    // Snapshot enough to restore each item on undo: name, category, and
    // whether it lives in the household's shared scope or the caller's
    // personal scope (mirrors createGroceryItem's `personal` flag).
    const restoreSnapshot = boughtItems.map((item) => ({
      name: item.name,
      categoryId: item.categoryId,
      personal: item.userId !== null,
    }));
    const ids = boughtItems.map((item) => item.id);

    try {
      await deleteItems(ids);
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.filter((item) => !ids.includes(item.id)),
      }));
      toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} verwijderd`, {
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            try {
              await restoreItems(restoreSnapshot);
              fetchData(viewKey);
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
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      toast.error("Voer een itemnaam in");
      inputRef.current?.focus();
      return;
    }
    if (trimmedName.length > 30) {
      toast.error("Itemnaam mag maximaal 30 karakters zijn");
      inputRef.current?.focus();
      return;
    }

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
      name: trimmedName.toLowerCase(),
      quantity: 1,
      bought: false,
      householdId: showPersonal ? null : household.id,
      userId: null,
      categoryId: addCategory?.id ?? null,
      category: addCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    updateView(viewKey, (data) => ({
      ...data,
      items: [...data.items, optimisticItem],
    }));
    setItemName("");
    inputRef.current?.focus();
    // Scroll the actual scrolling element (the <main> content area, not the
    // list's own div) to the bottom now that the user added an item.
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
    });

    try {
      const newItem = await createGroceryItem(trimmedName, showPersonal, addCategory?.id ?? null);
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.map((item) =>
          item.id === tempId ? { ...newItem, category: addCategory } : item
        ),
      }));
    } catch (error) {
      console.error("Failed to create grocery item:", error);
      const errorMessage = error instanceof Error ? error.message : "Toevoegen mislukt";
      toast.error(errorMessage);
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.filter((item) => item.id !== tempId),
      }));
    }
  };

  const handleDragEnd = async (groceryId: number, categoryId: number | null) => {
    // Find the current item to check if category actually changed
    const currentItem = groceryList.find((item) => item.id === groceryId);
    if (!currentItem) return;

    // Check if category actually changed
    const categoryChanged = currentItem.categoryId !== categoryId;
    if (!categoryChanged) return; // Don't update or show toast if nothing changed

    // Store previous state for rollback
    const previousCategoryId = currentItem.categoryId;
    const previousCategory = currentItem.category;

    // Optimistic update - update local state immediately
    const targetCategory = categories.find((c) => c.id === categoryId) || null;
    updateView(viewKey, (data) => ({
      ...data,
      items: data.items.map((item) =>
        item.id === groceryId ? { ...item, categoryId, category: targetCategory } : item
      ),
    }));

    try {
      await updateGroceryCategory(groceryId, categoryId);
    } catch (error) {
      // Revert on error
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.map((item) =>
          item.id === groceryId
            ? { ...item, categoryId: previousCategoryId, category: previousCategory }
            : item
        ),
      }));
      console.error("Failed to update category:", error);
      toast.error("Verplaatsen mislukt");
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteCategory(categoryId);
      updateView(viewKey, (data) => ({
        items: data.items.map((item) =>
          item.categoryId === categoryId ? { ...item, categoryId: null, category: null } : item
        ),
        categories: data.categories.filter((cat) => cat.id !== categoryId),
      }));
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
    // A negative id is an optimistic temp item whose create is still in
    // flight; there is no server row to delete yet.
    if (groceryId < 0) return;
    const item = groceryList.find((i) => i.id === groceryId);
    if (!item) return;

    const restoreSnapshot = [
      {
        name: item.name,
        categoryId: item.categoryId,
        personal: item.userId !== null,
        bought: item.bought ?? false,
      },
    ];

    updateView(viewKey, (data) => ({
      ...data,
      items: data.items.filter((i) => i.id !== groceryId),
    }));

    try {
      await deleteItems([groceryId]);
      toast.success(`"${item.name}" verwijderd`, {
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            try {
              await restoreItems(restoreSnapshot);
              fetchData(viewKey);
            } catch (error) {
              console.error("Failed to restore item:", error);
              toast.error("Herstellen mislukt");
            }
          },
        },
      });
    } catch (error) {
      // Revert: put the item back where it was.
      updateView(viewKey, (data) => ({ ...data, items: [...data.items, item] }));
      console.error("Failed to delete item:", error);
      toast.error("Verwijderen mislukt");
    }
  };

  const handleRenameItem = async (groceryId: number, newName: string) => {
    try {
      await updateGroceryName(groceryId, newName);
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.map((item) =>
          item.id === groceryId ? { ...item, name: newName } : item
        ),
      }));
      toast.success("Item hernoemd");
    } catch (error) {
      console.error("Failed to rename item:", error);
      toast.error("Hernoemen mislukt");
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <PageHeader title={showPersonal ? "Persoonlijk" : household.name} left={<HuisButton />} />

      {/* List-view toggle directly under the header: it's navigation (which
          list you're looking at), kept away from the footer now that the
          platform tab bar lives down there too. */}
      <div className="w-full max-w-2xl mx-auto shrink-0 px-4 pt-3">
        <ViewToggle showPersonal={showPersonal} onToggle={handleToggleView} />
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
          showCategories={true}
          busyRef={busyRef}
        />
        {/* Quiet "add category" affordance at the very end of the list (the
            user's thumb lives at the bottom of the screen). Same dialog as
            before, just a full-width muted ghost row as its trigger. */}
        <AddCategory
          showPersonal={showPersonal}
          onCategoryAdded={() => fetchData(viewKey)}
          trigger={
            <Button
              variant="ghost"
              className="mt-4 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Categorie toevoegen
            </Button>
          }
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
              onValueChange={(value) =>
                setTargetCategoryId(value === "none" ? null : Number(value))
              }
            >
              {/* Compact chip: icon + chevron only while no category is
                  targeted; a short truncated name (max 35% of the bar) once
                  one is. The input keeps the majority of the row. */}
              <SelectTrigger
                aria-label="Categorie voor nieuwe items"
                className={
                  targetCategory
                    ? "h-8 max-w-[35%] shrink-0 gap-1 rounded-md border-0 bg-secondary px-2 text-xs font-medium text-muted-foreground shadow-none"
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
                  // After picking a category, put the caret straight back in
                  // the item input so the user can type the item name.
                  e.preventDefault();
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
              </SelectContent>
            </Select>
            <Input
              ref={inputRef}
              className="flex-1 min-w-0 h-full border-0 shadow-none bg-transparent px-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Voeg een item toe..."
              value={itemName}
              maxLength={30}
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
