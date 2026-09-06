"use client";

import type { Category } from "@prisma/client";
import { useRef, useState } from "react";
import { User, House, Loader2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { appendCategory, type ViewData, type ViewKey } from "@/src/lib/house/grocery-view";
import GroceryList from "@/src/components/house/grocery-list";
import type { AddCategoryActions } from "@/src/components/add-category";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import AddBar from "./add-bar";
import { useGroceryEdits, type GroceryEditActions } from "./use-grocery-edits";
import { useGroceryViews, type GroceryViewActions } from "./use-grocery-views";

/**
 * Everything the home screen can do, handed down from the server page in one
 * prop. Reading the list is here too: getHomeData is a server action like the
 * rest, and the page polls it. Keeps Prisma out of anything that renders this.
 */
export type HomeActions = GroceryViewActions & GroceryEditActions & AddCategoryActions;

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

// The "n in je mandje / Wissen" bar docked above the add bar (WP-10): checked
// items stay visible in their categories, so clearing them is a deliberate,
// separate action rather than tucked inside a collapsed section. Collapsed by
// CSS (height/opacity) while nothing is checked, so it animates in and out.
function ClearBoughtBar({
  count,
  clearing,
  onClear,
}: {
  count: number;
  clearing: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-2xl overflow-hidden transition-all duration-150 ease-out ${
        count > 0 ? "mb-2 max-h-12 opacity-100" : "mb-0 max-h-0 opacity-0"
      }`}
    >
      <div className="flex h-10 items-center justify-between rounded-lg bg-secondary px-3">
        <span className="text-sm text-muted-foreground">{count} in je mandje</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={clearing}
          className="h-8 gap-1.5 px-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {clearing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Wissen
        </Button>
      </div>
    </div>
  );
}

export default function HouseholdClientPage({
  householdId,
  initialData,
  actions,
}: HouseholdClientPageProps) {
  const views = useGroceryViews(initialData, actions);
  const edits = useGroceryEdits(householdId, views, actions);
  // The category new items land in ("quick add with category"). Sticky across
  // consecutive adds; reset to "Geen categorie" (null) when switching lists.
  const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The <main> element is the actual scrolling container (overflow-y-auto);
  // scrolled to bottom only after the current user adds an item.
  const mainRef = useRef<HTMLElement>(null);

  // Resolved against the visible view's categories, so a category that was
  // deleted (locally or by a poll refresh) silently falls back to
  // "Geen categorie" instead of pointing at a stale id.
  const targetCategory = views.categories.find((c) => c.id === targetCategoryId) ?? null;
  const boughtCount = views.items.filter((item) => item.bought).length;

  const handleToggleView = (next: ViewKey) => {
    // The target category belongs to the previously visible list; the other
    // list has its own categories, so reset to "Geen categorie".
    setTargetCategoryId(null);
    views.switchView(next);
  };

  const handleAdd = (name: string, category: Category | null) => {
    edits.add(name, category);
    // Scroll the actual scrolling element (the <main> content area, not the
    // list's own div) to the bottom now that the user added an item.
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  // "+" on a category section header: pre-target that category in the add-bar
  // chip and focus the one shared input (no per-category inputs).
  const handleAddToCategory = (categoryId: number) => {
    setTargetCategoryId(categoryId);
    inputRef.current?.focus();
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
        <ViewToggle view={views.view} onToggle={handleToggleView} />
      </div>

      {/* Main scrollable content area */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 pt-4 pb-6"
      >
        <GroceryList
          groceryList={views.items}
          categories={views.categories}
          isLoading={views.isLoading}
          onToggleBought={edits.toggleBought}
          onDragEnd={edits.moveToCategory}
          onDeleteCategory={edits.deleteCategory}
          onRenameItem={edits.rename}
          onAddToCategory={handleAddToCategory}
          onDeleteItem={edits.deleteItem}
          onBusyChange={views.setBusy}
        />
      </main>

      {/* Footer - Fixed at bottom: an optional clear-all bar, then the add
          bar. The platform tab bar renders below this and owns the iOS
          safe-area inset. */}
      <footer className="w-full shrink-0 border-t border-border bg-background px-4 py-3">
        <ClearBoughtBar
          count={boughtCount}
          clearing={edits.isClearingBought}
          onClear={edits.clearBought}
        />
        <AddBar
          view={views.view}
          categories={views.categories}
          targetCategory={targetCategory}
          onTargetCategoryChange={setTargetCategoryId}
          onAdd={handleAdd}
          onCategoryCreated={(category) => {
            // Optimistically, so the chip doesn't wait on the refetch.
            views.update((data) => appendCategory(data, category));
            views.refresh({ silent: true });
          }}
          onCreateCategory={actions.onCreateCategory}
          inputRef={inputRef}
        />
      </footer>
    </div>
  );
}
