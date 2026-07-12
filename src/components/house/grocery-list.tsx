"use client";

import { Grocery, Category } from "@prisma/client";
import { ShoppingCart, Trash2, Pencil, GripVertical, Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
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
  useDraggable,
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

type GroceryWithCategory = Grocery & { category: Category | null };

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
  showCategories?: boolean;
  /** Set to true while a drag or inline rename is in progress, so callers (e.g. polling) can skip clobbering it. */
  busyRef?: React.MutableRefObject<boolean>;
};

// The leading round checkbox: purely visual (a bordered circle, filled with a
// Check icon when bought), the whole row is the actual tap target.
function CheckCircle({ bought }: { bought: boolean }) {
  return (
    <div
      className={`
        h-[22px] w-[22px] flex-shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-colors
        ${bought ? "bg-primary border-primary" : "border-gray-300"}
      `}
    >
      {bought && <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />}
    </div>
  );
}

// Width of the red "Verwijderen" action revealed by swiping a row left.
const SWIPE_ACTION_WIDTH = 96;
// A gesture must move this many px before we decide it's a swipe or a scroll.
const SWIPE_INTENT_THRESHOLD = 12;

function DraggableGroceryItem({
  item,
  onToggleBought,
  onRename,
  onDelete,
  onEditingChange,
}: {
  item: GroceryWithCategory;
  onToggleBought: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const bought = item.bought ?? false;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  // Checked rows can't be dragged (pointless mid-trip, avoids accidental
  // drags) — disabled here (not just handle-hidden) so it holds even if
  // something else ever renders a handle for a bought row.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: bought,
  });

  // Swipe-to-delete state. The gesture is tracked with pointer events on the
  // row body only — the drag handle belongs to dnd-kit (its PointerSensor /
  // TouchSensor listeners are attached to the handle element exclusively, so
  // a horizontal swipe on the body can never start a drag). `touch-pan-y`
  // on the row keeps native vertical scrolling working: the browser handles
  // vertical pans itself and only lets horizontal movement reach us.
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeRef = useRef({
    startX: 0,
    startY: 0,
    baseX: 0,
    pointerId: -1,
    // idle → pending (pointer down) → swiping (horizontal intent) | cancelled (vertical intent)
    mode: "idle" as "idle" | "pending" | "swiping" | "cancelled",
  });
  // Set when a swipe gesture just ended, so the click that the browser fires
  // right after pointerup doesn't also toggle the item as bought.
  const justSwipedRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    setIsEditing(true);
    onEditingChange?.(true);
  };

  const stopEditing = () => {
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const handleSave = () => {
    const trimmed = editValue.trim().slice(0, 30);
    if (trimmed && trimmed !== item.name) {
      onRename(trimmed);
    } else {
      setEditValue(item.name);
    }
    stopEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(item.name);
      stopEditing();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    // Gestures starting on the drag handle are dnd-kit's, not ours.
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
    const s = swipeRef.current;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.baseX = swipeX;
    s.pointerId = e.pointerId;
    s.mode = "pending";
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (e.pointerId !== s.pointerId) return;
    if (s.mode !== "pending" && s.mode !== "swiping") return;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;

    if (s.mode === "pending") {
      // Vertical movement dominates: this is a scroll, leave it alone.
      if (Math.abs(dy) > SWIPE_INTENT_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        s.mode = "cancelled";
        return;
      }
      // Horizontal movement dominates: claim the gesture as a swipe.
      if (Math.abs(dx) > SWIPE_INTENT_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        s.mode = "swiping";
        setIsSwiping(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        return;
      }
    }

    // Track the finger: only leftward reveal, with a little overshoot room.
    const next = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH - 24, s.baseX + dx));
    setSwipeX(next);
  };

  const settleSwipe = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (e.pointerId !== s.pointerId) return;
    if (s.mode === "swiping") {
      justSwipedRef.current = true;
      setIsSwiping(false);
      // Snap open when past half the action width, else snap back shut.
      setSwipeX((x) => (x < -SWIPE_ACTION_WIDTH / 2 ? -SWIPE_ACTION_WIDTH : 0));
    }
    s.mode = "idle";
    s.pointerId = -1;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (e.pointerId !== s.pointerId) return;
    if (s.mode === "swiping") {
      setIsSwiping(false);
      setSwipeX(0);
    }
    s.mode = "idle";
    s.pointerId = -1;
  };

  const handleRowClick = () => {
    // The click fired by the browser right after a swipe ends must not
    // toggle the item.
    if (justSwipedRef.current) {
      justSwipedRef.current = false;
      return;
    }
    // Tapping a row whose delete action is revealed closes it again.
    if (swipeX !== 0) {
      setSwipeX(0);
      return;
    }
    onToggleBought();
  };

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : swipeX !== 0
        ? `translateX(${swipeX}px)`
        : undefined,
    transition: isSwiping || isDragging ? undefined : "transform 150ms ease-out",
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-white ring-1 ring-primary">
        <div className="h-[22px] w-[22px] flex-shrink-0" />
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={30}
          className="h-7 text-base border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete action revealed behind the row by swiping left. Kept
          `invisible` (not just covered) while the row is at rest so it can
          never bleed through the row, whatever the browser does with
          stacking/paint of the translated row above it. */}
      <button
        onClick={() => {
          setSwipeX(0);
          onDelete();
        }}
        tabIndex={swipeX === 0 ? -1 : 0}
        aria-hidden={swipeX === 0}
        className={`absolute inset-y-0 right-0 w-24 bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center ${
          isDragging ? "hidden" : ""
        } ${swipeX === 0 && !isSwiping ? "invisible" : ""}`}
      >
        Verwijderen
      </button>
      <div
        ref={setNodeRef}
        style={style}
        onClick={handleRowClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={settleSwipe}
        onPointerCancel={handlePointerCancel}
        className={`
          relative flex items-center space-x-2 p-2.5 rounded-lg cursor-pointer group select-none touch-pan-y
          bg-white transition-colors active:bg-gray-100
          ${isDragging ? "opacity-0" : ""}
        `}
      >
        <CheckCircle bought={bought} />
        <span
          className={`truncate w-full text-base min-w-0 first-letter:uppercase ${
            bought ? "text-gray-400 line-through" : "text-gray-800 font-medium"
          }`}
        >
          {item.name}
        </span>
        {/* Checked rows stay minimal: circle + struck name only. Renaming a
            checked item is pointless, and it can't be dragged (see
            `disabled: bought` above) so the handle is hidden too. Swipe
            still works — it's wired on the row body, not these buttons. */}
        {!bought && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
            className="h-11 w-11 -my-2 flex items-center justify-center hover:bg-gray-100 rounded shrink-0"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
        {!bought && (
          <div
            {...listeners}
            {...attributes}
            data-drag-handle
            className="h-11 w-11 -my-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

function UncategorizedItems({
  items,
  isDragActive,
  onToggleBought,
  onRenameItem,
  onDeleteItem,
  onItemEditingChange,
}: {
  /** Both checked and unchecked items — unchecked first, checked sunk below (WP-10). */
  items: GroceryWithCategory[];
  isDragActive: boolean;
  onToggleBought: (id: number, bought: boolean) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onDeleteItem: (groceryId: number) => void;
  onItemEditingChange?: (id: number, editing: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "uncategorized" });

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
        <span className="ml-1.5 font-normal normal-case text-gray-400">
          {items.filter((item) => !item.bought).length}
        </span>
      </h3>
      {items.map((item) => (
        <DraggableGroceryItem
          key={item.id}
          item={item}
          onToggleBought={() => onToggleBought(item.id, !(item.bought ?? false))}
          onRename={(newName) => onRenameItem(item.id, newName)}
          onDelete={() => onDeleteItem(item.id)}
          onEditingChange={(editing) => onItemEditingChange?.(item.id, editing)}
        />
      ))}
    </div>
  );
}

function DroppableCategory({
  id,
  title,
  items,
  uncheckedCount,
  onToggleBought,
  onDelete,
  onRenameItem,
  onAdd,
  onDeleteItem,
  onItemEditingChange,
  isDragActive,
}: {
  id: string;
  title: string;
  /** Both checked and unchecked items — unchecked first, checked sunk below (WP-10). */
  items: GroceryWithCategory[];
  /** Header shows what's left to buy, not the total (WP-10). */
  uncheckedCount: number;
  onToggleBought: (id: number, bought: boolean) => void;
  onDelete?: () => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onAdd?: () => void;
  onDeleteItem: (groceryId: number) => void;
  onItemEditingChange?: (id: number, editing: boolean) => void;
  isDragActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // A category whose items are all checked still has items — it stays
  // expanded, not collapsed to the empty drop-line (WP-10).
  const isEmpty = items.length === 0;

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
          {items.map((item) => (
            <DraggableGroceryItem
              key={item.id}
              item={item}
              onToggleBought={() => onToggleBought(item.id, !(item.bought ?? false))}
              onRename={(newName) => onRenameItem(item.id, newName)}
              onDelete={() => onDeleteItem(item.id)}
              onEditingChange={(editing) => onItemEditingChange?.(item.id, editing)}
            />
          ))}
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
  showCategories = true,
  busyRef,
}: GroceryListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  // Non-empty category pending delete confirmation (empty ones delete
  // immediately, no dialog).
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const editingIdsRef = useRef<Set<number>>(new Set());

  const handleItemEditingChange = (id: number, editing: boolean) => {
    if (editing) {
      editingIdsRef.current.add(id);
    } else {
      editingIdsRef.current.delete(id);
    }
    if (busyRef) {
      busyRef.current = activeDragId !== null || editingIdsRef.current.size > 0;
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (busyRef) busyRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (busyRef) busyRef.current = editingIdsRef.current.size > 0;

    if (!over) return;

    const groceryId = active.id as number;
    let categoryId: number | null = null;

    const overId = over.id.toString();

    if (overId === "uncategorized") {
      // Dropped on uncategorized zone
      categoryId = null;
    } else if (overId.startsWith("category-")) {
      // Dropped on a category container
      categoryId = parseInt(overId.replace("category-", ""));
    } else {
      // Dropped on another grocery item - find its category
      const targetItemId = parseInt(overId);
      const targetItem = groceryList.find((item) => item.id === targetItemId);
      if (targetItem) {
        categoryId = targetItem.categoryId;
      }
    }

    onDragEnd(groceryId, categoryId);
  };

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

  // Checked items stay inside their own category group (WP-10): within a
  // group, unchecked items come first (existing order), checked items sink
  // below, most-recently-checked first. The header count is what's left to
  // buy, so it's tracked separately from the (checked + unchecked) items
  // that actually get rendered.
  const sortGroup = (items: GroceryWithCategory[]) => {
    const unchecked = items.filter((item) => !item.bought);
    const checked = items
      .filter((item) => item.bought)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { items: [...unchecked, ...checked], uncheckedCount: unchecked.length };
  };

  const uncategorizedGroup = sortGroup(groceryList.filter((item) => !item.categoryId));
  const categorizedItems = categories.map((category) => ({
    category,
    ...sortGroup(groceryList.filter((item) => item.categoryId === category.id)),
  }));
  // Don't filter out empty categories - show all categories (and a category
  // that's fully checked isn't "empty" either — sortGroup keeps its items).

  const isDragActive = activeDragId !== null;
  const activeItem = groceryList.find((item) => item.id === activeDragId);

  // Render list content (common for both draggable and non-draggable modes)
  const renderContent = () => (
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
          {showCategories &&
            categorizedItems.map(({ category, items, uncheckedCount }) => (
              <DroppableCategory
                key={category.id}
                id={`category-${category.id}`}
                title={category.name}
                items={items}
                uncheckedCount={uncheckedCount}
                onToggleBought={onToggleBought}
                onDelete={() => requestDeleteCategory(category)}
                onRenameItem={onRenameItem}
                onAdd={onAddToCategory ? () => onAddToCategory(category.id) : undefined}
                onDeleteItem={onDeleteItem}
                onItemEditingChange={handleItemEditingChange}
                isDragActive={isDragActive}
              />
            ))}

          {/* Uncategorized zone - only while it has items (checked or
              unchecked), or as a thin labeled drop line while a drag is in
              progress */}
          {showCategories && (uncategorizedGroup.items.length > 0 || isDragActive) && (
            <UncategorizedItems
              items={uncategorizedGroup.items}
              isDragActive={isDragActive}
              onToggleBought={onToggleBought}
              onRenameItem={onRenameItem}
              onDeleteItem={onDeleteItem}
              onItemEditingChange={handleItemEditingChange}
            />
          )}

          {/* Simple list when categories are disabled */}
          {!showCategories && uncategorizedGroup.items.length > 0 && (
            <div className="space-y-1 py-3">
              {uncategorizedGroup.items.map((item) => (
                <DraggableGroceryItem
                  key={item.id}
                  item={item}
                  onToggleBought={() => onToggleBought(item.id, !(item.bought ?? false))}
                  onRename={(newName) => onRenameItem(item.id, newName)}
                  onDelete={() => onDeleteItem(item.id)}
                  onEditingChange={(editing) => handleItemEditingChange(item.id, editing)}
                />
              ))}
            </div>
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

  const content = renderContent();

  // When categories are disabled, render simple list without DndContext
  if (!showCategories) {
    return content;
  }

  // The list content itself (rows, categories) must render in the server
  // HTML so WP-2's fast first paint isn't wasted. Only the drag layer
  // (DndContext + DragOverlay) is gated on mount — dnd-kit's sensors touch
  // the DOM/window and can mismatch between server and client — so it's
  // wrapped around the already-rendered `content` instead of replacing it.
  if (!isMounted) {
    return content;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoScroll={{
        threshold: { x: 0, y: 0.2 },
        acceleration: 15,
      }}
    >
      {content}

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
