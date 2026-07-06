"use client";

import { Grocery, Household, Category } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { User, House, Plus, Info, LogOut } from "lucide-react";
import { getHomeData } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
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
import { toast } from "sonner";
import Link from "next/link";
import { signOut } from "next-auth/react";

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

    // Optimistic insert: a temp item (negative id) appears immediately, the
    // input clears and stays enabled so the user can keep typing the next
    // item, and we reconcile with (or roll back to) the server afterwards.
    const tempId = tempIdRef.current--;
    const optimisticItem: GroceryWithCategory = {
      id: tempId,
      name: trimmedName.toLowerCase(),
      quantity: 1,
      bought: false,
      householdId: showPersonal ? null : household.id,
      userId: null,
      categoryId: null,
      category: null,
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
      const newItem = await createGroceryItem(trimmedName, showPersonal);
      updateView(viewKey, (data) => ({
        ...data,
        items: data.items.map((item) =>
          item.id === tempId ? { ...newItem, category: null } : item
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
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header - Fixed at top */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 w-full py-6 shadow-lg">
        <div className="flex flex-row justify-center items-center relative px-4">
          <div className="absolute left-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="text-white hover:bg-white/20 active:bg-white/30 active:scale-95 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
          <h2 className="text-2xl text-white font-bold tracking-wide drop-shadow-md">
            {showPersonal ? "Persoonlijk" : household.name}
          </h2>
          <div className="absolute right-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-white hover:bg-white/20 active:bg-white/30 active:scale-95 transition-all"
            >
              <Link href="/household-info">
                <Info className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main scrollable content area */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-6 pt-6 pb-6"
      >
        <div className="mb-4 flex justify-end">
          <AddCategory showPersonal={showPersonal} onCategoryAdded={() => fetchData(viewKey)} />
        </div>
        <GroceryList
          groceryList={groceryList}
          categories={categories}
          isLoading={isLoading}
          onToggleBought={handleToggleBought}
          onDragEnd={handleDragEnd}
          onDeleteCategory={handleDeleteCategory}
          onRenameItem={handleRenameItem}
          onClearBought={handleClearBought}
          isClearingBought={isClearingBought}
          showCategories={true}
          busyRef={busyRef}
        />
      </main>

      {/* Footer - Fixed at bottom */}
      <footer className="w-full bg-white/95 backdrop-blur-sm shadow-2xl border-t border-gray-200 px-4 pt-4 pb-6">
        <div className="relative flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto px-2">
          <Input
            ref={inputRef}
            className="bg-white shadow-md border-2 border-gray-200 focus:border-blue-500 transition-colors h-12 text-base"
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
            className="h-12 w-12 shadow-md hover:shadow-lg active:scale-95 transition-all"
          >
            <Plus />
          </Button>
        </div>
        <div className="relative flex flex-row justify-center gap-3 pt-4 pb-2">
          <Button
            variant={!showPersonal ? "default" : "outline"}
            size="lg"
            onClick={() => handleToggleView(false)}
            className="min-w-[120px] shadow-md hover:shadow-lg active:scale-95 transition-all gap-2"
          >
            <House className="w-4 h-4" />
            Huishouden
          </Button>
          <Button
            variant={showPersonal ? "default" : "outline"}
            size="lg"
            onClick={() => handleToggleView(true)}
            className="min-w-[120px] shadow-md hover:shadow-lg active:scale-95 transition-all gap-2"
          >
            <User className="w-4 h-4" />
            Persoonlijk
          </Button>
        </div>
      </footer>
    </div>
  );
}
