"use client";

import { Category } from "@prisma/client";
import {
  groupByCategory,
  resolveDropCategory,
  categoryDropId,
  UNCATEGORIZED_DROP_ID,
} from "@/src/lib/house/grocery-order";
import { MAX_ITEM_NAME_LENGTH, type GroceryWithCategory } from "@/src/lib/house/grocery-view";
import { formatQuantity } from "@/src/lib/quantity";
import { ShoppingCart, Trash2, Pencil, GripVertical, Check, Plus } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const quantityLabel = formatQuantity(item.quantity, item.unit);
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
  // The live offset is a ref, not state: following a finger is ~90 pointermove
  // events, and React only ever needs to know the two things below — whether a
  // gesture is running, and whether it ended open. The pixels are written
  // straight to the node, and re-applied after any render that would drop them.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
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

  // Safe to leave to the node between renders: `style` below never sets
  // transform unless dnd-kit is dragging, and React only writes the style
  // properties it manages — so a poll re-rendering the row leaves this alone.
  const applyOffset = () => {
    const node = rowRef.current;
    // While dnd-kit is dragging, the transform is its own — never fight it.
    if (!node || transform) return;
    node.style.transform = offsetRef.current === 0 ? "" : `translateX(${offsetRef.current}px)`;
  };

  /** The single way a revealed row goes back to rest. */
  const close = () => {
    offsetRef.current = 0;
    applyOffset();
    setIsOpen(false);
  };

  const startEditing = () => {
    setIsEditing(true);
    onEditingChange?.(true);
  };

  const stopEditing = () => {
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const handleSave = () => {
    // Length is the input's job (maxLength) and normalization the caller's, so
    // all that is decided here is whether there is a change worth saving.
    const trimmed = editValue.trim();
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
    s.baseX = offsetRef.current;
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
    offsetRef.current = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH - 24, s.baseX + dx));
    applyOffset();
  };

  const settleSwipe = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (e.pointerId !== s.pointerId) return;
    if (s.mode === "swiping") {
      justSwipedRef.current = true;
      // Snap open when past half the action width, else snap back shut.
      const open = offsetRef.current < -SWIPE_ACTION_WIDTH / 2;
      offsetRef.current = open ? -SWIPE_ACTION_WIDTH : 0;
      applyOffset();
      setIsSwiping(false);
      setIsOpen(open);
    }
    s.mode = "idle";
    s.pointerId = -1;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (e.pointerId !== s.pointerId) return;
    if (s.mode === "swiping") {
      setIsSwiping(false);
      close();
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
    if (isOpen) {
      close();
      return;
    }
    onToggleBought();
  };

  const style: React.CSSProperties = {
    // Only dnd-kit's transform is set here; the swipe offset is written to the
    // node by applyOffset, so following a finger costs no renders at all.
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
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
          maxLength={MAX_ITEM_NAME_LENGTH}
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
          close();
          onDelete();
        }}
        tabIndex={isOpen ? 0 : -1}
        aria-hidden={!isOpen}
        className={`absolute inset-y-0 right-0 w-24 bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center ${
          isDragging ? "hidden" : ""
        } ${!isOpen && !isSwiping ? "invisible" : ""}`}
      >
        Verwijderen
      </button>
      <div
        data-row-body
        ref={(node) => {
          rowRef.current = node;
          setNodeRef(node);
        }}
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
          className={`truncate flex-1 text-base min-w-0 first-letter:uppercase ${
            bought ? "text-gray-400 line-through" : "text-gray-800 font-medium"
          }`}
        >
          {item.name}
        </span>
        {quantityLabel && (
          <span className="shrink-0 text-sm text-gray-400 tabular-nums">{quantityLabel}</span>
        )}
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
            aria-label={`${item.name} hernoemen`}
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
    <DraggableGroceryItem
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

  const handleItemEditingChange = (id: number, editing: boolean) => {
    if (editing) {
      editingIdsRef.current.add(id);
    } else {
      editingIdsRef.current.delete(id);
    }
    onBusyChange(activeDragId !== null || editingIdsRef.current.size > 0);
  };

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

  const rowActions: RowActions = {
    onToggleBought,
    onRenameItem,
    onDeleteItem,
    onItemEditingChange: handleItemEditingChange,
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
