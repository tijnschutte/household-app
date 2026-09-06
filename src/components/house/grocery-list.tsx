"use client";

import { Category } from "@prisma/client";
import {
  groupByCategory,
  resolveDropCategory,
  categoryDropId,
  UNCATEGORIZED_DROP_ID,
} from "@/src/lib/house/grocery-order";
import { type GroceryWithCategory } from "@/src/lib/house/grocery-view";
import { ShoppingCart, Trash2, Plus } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { GroceryRow } from "./grocery-row";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

type GroceryListProps = {
  groceryList: GroceryWithCategory[];
  categories: Category[];
  isLoading: boolean;
  onToggleBought: (id: number, bought: boolean) => void;
  onDragEnd: (groceryId: number, categoryId: number | null) => void;
  onDeleteCategory: (categoryId: number) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  /** "+" on a category header: pre-target that category in the add bar and focus the input. */
  onAddToCategory?: (categoryId: number) => void;
  /** Swipe-to-delete on a row: delete this single item (with undo toast upstream). */
  onDeleteItem: (groceryId: number) => void;
  /**
   * True while a drag or inline rename is in progress. The caller decides what
   * to do about it — polling skips a silent refresh rather than clobbering an
   * edit in flight. Reported, not written into a ref the caller lends us.
   */
  onBusyChange: (busy: boolean) => void;
};

/**
 * What can be done to a row, supplied once by GroceryList.
 *
 * The zone components below are about layout and drop targets; which callback
 * a row fires is none of their business. Passing these through them meant a new
 * row operation had to be threaded through every zone on the way down.
 */
type RowActions = {
  onToggleBought: (id: number, bought: boolean) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onDeleteItem: (groceryId: number) => void;
  onItemEditingChange: (id: number, editing: boolean) => void;
};

const RowActionsContext = createContext<RowActions | null>(null);

/**
 * The rows of one group. The per-item bindings live here so the two zones
 * cannot disagree about them — notably the `?? false` an absent `bought` needs.
 */
function GroceryRows({ items }: { items: GroceryWithCategory[] }) {
  const actions = useContext(RowActionsContext);
  // Only GroceryList renders these, and it always provides the context.
  if (!actions) throw new Error("GroceryRows rendered outside GroceryList");

  return items.map((item) => (
    <GroceryRow
      key={item.id}
      item={item}
      onToggleBought={() => actions.onToggleBought(item.id, !(item.bought ?? false))}
      onRename={(newName) => actions.onRenameItem(item.id, newName)}
      onDelete={() => actions.onDeleteItem(item.id)}
      onEditingChange={(editing) => actions.onItemEditingChange(item.id, editing)}
    />
  ));
}

function UncategorizedItems({
  items,
  uncheckedCount,
  isDragActive,
}: {
  /** Both checked and unchecked items — unchecked first, checked sunk below (WP-10). */
  items: GroceryWithCategory[];
  /** Header shows what's left to buy, not the total (WP-10). */
  uncheckedCount: number;
  isDragActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNCATEGORIZED_DROP_ID });

  // Empty (no items at all, checked or unchecked) and only visible because a
  // drag is in progress: a thin labeled drop line, not a tall empty box. A
  // zone that's fully checked still has items, so it stays expanded.
  if (items.length === 0) {
    return (
      <div ref={setNodeRef} className="flex items-center gap-2 px-1 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 shrink-0">
          Geen categorie
        </span>
        <div
          className={`flex-1 rounded border border-dashed transition-all ${
            isOver ? "h-8 border-primary bg-primary/10" : "h-1.5 border-gray-300"
          }`}
        />
      </div>
    );
  }

  return (
    // No border-radius here: this element carries the divide-y hairline, and
    // a radius would make the divider curve up at its ends (ghost-row look).
    <div
      ref={setNodeRef}
      className={`space-y-1 py-3 transition-colors ${isDragActive && isOver ? "bg-primary/5" : ""}`}
    >
      {/* Same header treatment as a category, so these items can't read as
          belonging to the section above them. */}
      <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Geen categorie
        <span className="ml-1.5 font-normal normal-case text-gray-400">{uncheckedCount}</span>
      </h3>
      <GroceryRows items={items} />
    </div>
  );
}

function DroppableCategory({
  id,
  title,
  items,
  uncheckedCount,
  onDelete,
  onAdd,
  isDragActive,
}: {
  id: string;
  title: string;
  /** Both checked and unchecked items — unchecked first, checked sunk below (WP-10). */
  items: GroceryWithCategory[];
  /** Header shows what's left to buy, not the total (WP-10). */
  uncheckedCount: number;
  onDelete?: () => void;
  onAdd?: () => void;
  isDragActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // A category whose items are all checked still has items — it stays
  // expanded, not collapsed to the empty drop-line (WP-10).
  const isEmpty = items.length === 0;

  // Empty categories are hidden at rest to keep the list tidy. They come
  // back (header, delete button, drop line) while a drag is active, and
  // stay selectable in the add-bar picker.
  if (isEmpty && !isDragActive) return null;

  return (
    // No border-radius here: this element carries the divide-y hairline, and
    // a radius would make the divider curve up at its ends (ghost-row look).
    <div ref={setNodeRef} className={`py-3 transition-colors ${isOver ? "bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          <span className="ml-1.5 font-normal normal-case text-gray-400">{uncheckedCount}</span>
        </h3>
        <div className="flex items-center gap-0.5">
          {onAdd && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAdd}
              aria-label={`Item toevoegen aan ${title}`}
              className="h-7 w-7 p-0 text-gray-400 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label={`Categorie ${title} verwijderen`}
              className="h-7 w-7 p-0 text-gray-400 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {isEmpty ? (
        // Empty category at rest is just its header; the dashed drop line
        // only appears while a drag is in progress (grows/highlights on hover).
        isDragActive && (
          <div
            className={`mx-1 mt-1 rounded border border-dashed transition-all ${
              isOver ? "h-8 border-primary bg-primary/10" : "h-1.5 border-gray-300"
            }`}
          />
        )
      ) : (
        <div className="space-y-1">
          <GroceryRows items={items} />
        </div>
      )}
    </div>
  );
}

export default function GroceryList({
  groceryList,
  categories,
  isLoading,
  onToggleBought,
  onDragEnd,
  onDeleteCategory,
  onRenameItem,
  onAddToCategory,
  onDeleteItem,
  onBusyChange,
}: GroceryListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  // Non-empty category pending delete confirmation (empty ones delete
  // immediately, no dialog).
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const editingIdsRef = useRef<Set<number>>(new Set());

  const handleItemEditingChange = useCallback(
    (id: number, editing: boolean) => {
      if (editing) {
        editingIdsRef.current.add(id);
      } else {
        editingIdsRef.current.delete(id);
      }
      onBusyChange(activeDragId !== null || editingIdsRef.current.size > 0);
    },
    [activeDragId, onBusyChange]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // The 250ms hold delay distinguishes a drag from a scroll or a
    // horizontal swipe-to-delete gesture on touch devices. Keep it.
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
    onBusyChange(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    onBusyChange(editingIdsRef.current.size > 0);

    if (!over) return;

    onDragEnd(active.id as number, resolveDropCategory(over.id.toString(), groceryList));
  };

  // One object for as long as its parts hold still, so a poll that changes
  // nothing the rows act on does not redraw every row through the context.
  const rowActions = useMemo<RowActions>(
    () => ({
      onToggleBought,
      onRenameItem,
      onDeleteItem,
      onItemEditingChange: handleItemEditingChange,
    }),
    [onToggleBought, onRenameItem, onDeleteItem, handleItemEditingChange]
  );

  // A non-empty category asks for confirmation first; an empty one (counting
  // bought items too — they'd silently lose their category) deletes directly.
  const requestDeleteCategory = (category: Category) => {
    const hasItems = groceryList.some((item) => item.categoryId === category.id);
    if (hasItems) {
      setCategoryToDelete(category);
    } else {
      onDeleteCategory(category.id);
    }
  };

  const { uncategorized: uncategorizedGroup, categorized: categorizedItems } = groupByCategory(
    groceryList,
    categories
  );

  const isDragActive = activeDragId !== null;
  const activeItem = groceryList.find((item) => item.id === activeDragId);

  const content = (
    <div ref={listRef} className="w-full">
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!isLoading && groceryList.length === 0 && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
          <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Geen items</p>
          <p className="text-sm mt-1">Voeg je eerste item toe!</p>
        </div>
      )}

      {!isLoading && (
        // Groups (categories, uncategorized, checked) are flat: a small-caps
        // label, plain rows under it, and a single hairline between groups
        // supplied by divide-y here — no boxes-in-boxes.
        <div className="divide-y divide-gray-200">
          {/* Categorized Sections - Show all categories, even ones that are
              empty or fully checked (sortGroup never drops checked items) */}
          {categorizedItems.map(({ category, items, uncheckedCount }) => (
            <DroppableCategory
              key={category.id}
              id={categoryDropId(category.id)}
              title={category.name}
              items={items}
              uncheckedCount={uncheckedCount}
              onDelete={() => requestDeleteCategory(category)}
              onAdd={onAddToCategory ? () => onAddToCategory(category.id) : undefined}
              isDragActive={isDragActive}
            />
          ))}

          {/* Uncategorized zone - only while it has items (checked or
              unchecked), or as a thin labeled drop line while a drag is in
              progress */}
          {(uncategorizedGroup.items.length > 0 || isDragActive) && (
            <UncategorizedItems
              items={uncategorizedGroup.items}
              uncheckedCount={uncategorizedGroup.uncheckedCount}
              isDragActive={isDragActive}
            />
          )}
        </div>
      )}

      {/* Confirmation for deleting a category that still has items */}
      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Categorie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Items blijven bestaan en worden ongecategoriseerd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (categoryToDelete) onDeleteCategory(categoryToDelete.id);
                setCategoryToDelete(null);
              }}
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // The list content must render in the server HTML so WP-2's fast first paint
  // isn't wasted. What must never change between the first and second render
  // is the element type of what we return: swapping the root from a div to
  // DndContext is a type change, so React would throw the whole painted list
  // away and rebuild it.
  return (
    <DndContext
      // dnd-kit otherwise names its accessibility description from a
      // module-level counter, which the server and the client do not agree on.
      id="grocery-list"
      // Passed unconditionally, and it has to be. dnd-kit spreads the sensor
      // list into a dependency array; withholding the sensors until mount makes
      // that array grow from empty, and React does not support a dependency
      // array that changes size. It stops re-running the effect that attaches
      // the activators, so the drag handle keeps the listener-less props of the
      // first render and silently does nothing on a server-rendered page.
      // Nothing here needs the gate: these are plain descriptors, and dnd-kit
      // only touches the DOM from effects, which never run on the server.
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoScroll={{
        threshold: { x: 0, y: 0.2 },
        acceleration: 15,
      }}
    >
      <RowActionsContext.Provider value={rowActions}>{content}</RowActionsContext.Provider>

      <DragOverlay>
        {activeItem ? (
          <div className="bg-white border border-primary shadow-lg p-2.5 rounded-lg opacity-90">
            <span className="text-base font-medium first-letter:uppercase">{activeItem.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
