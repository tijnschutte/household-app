"use client";

import { type GroceryWithCategory } from "@/src/lib/house/grocery-view";
import { formatQuantity } from "@/src/lib/quantity";
import { useDraggable } from "@dnd-kit/core";
import { Check, GripVertical, Pencil } from "lucide-react";
import { useState } from "react";
import { GroceryNameEditor } from "./grocery-name-editor";
import { SWIPE_ACTION_WIDTH } from "./swipe-gesture";
import { useSwipeToDelete } from "./use-swipe-to-delete";

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

/**
 * The red "Verwijderen" behind the row, revealed by swiping left. Kept
 * `invisible` (not just covered) while the row is at rest so it can never
 * bleed through the row, whatever the browser does with stacking/paint of the
 * translated row above it. Only reachable (tab, screen reader) while revealed.
 */
function SwipeDeleteAction({
  revealed,
  revealing,
  hidden,
  onDelete,
}: {
  revealed: boolean;
  revealing: boolean;
  hidden: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      tabIndex={revealed ? 0 : -1}
      aria-hidden={!revealed}
      style={{ width: SWIPE_ACTION_WIDTH }}
      className={`absolute inset-y-0 right-0 bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center ${
        hidden ? "hidden" : ""
      } ${!revealed && !revealing ? "invisible" : ""}`}
    >
      Verwijderen
    </button>
  );
}

/**
 * What a row shows: the tick target (circle, name, where the quantity came
 * from, the quantity) and, for an unbought row, the rename and drag controls.
 *
 * Checked rows stay minimal: circle + struck name only. Renaming a checked
 * item is pointless, and it can't be dragged (see `disabled: bought` in
 * GroceryRow) so the handle is hidden too. Swipe still works — it's wired on
 * the row body, not these controls.
 */
function GroceryRowContent({
  item,
  bought,
  onToggle,
  onStartEditing,
  dragHandleProps,
}: {
  item: GroceryWithCategory;
  bought: boolean;
  onToggle: () => void;
  onStartEditing: () => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const quantityLabel = formatQuantity(item.quantity, item.unit);

  return (
    <>
      <button
        type="button"
        aria-pressed={bought}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center space-x-2 text-left"
      >
        <CheckCircle bought={bought} />
        <div className="min-w-0 flex-1">
          <span
            className={`block truncate text-base first-letter:uppercase ${
              bought ? "text-gray-400 line-through" : "text-gray-800 font-medium"
            }`}
          >
            {item.name}
          </span>
          {/* The recipe this row's quantity most recently came from — a
              hand-typed item, or one that predates D1, carries none. */}
          {item.sourceRecipeTitle && (
            <span className="block truncate text-xs text-gray-400 first-letter:uppercase">
              {item.sourceRecipeTitle}
            </span>
          )}
        </div>
        {quantityLabel && (
          <span className="shrink-0 text-sm text-gray-400 tabular-nums">{quantityLabel}</span>
        )}
      </button>
      {!bought && (
        <>
          <button
            type="button"
            onClick={onStartEditing}
            aria-label={`${item.name} hernoemen`}
            className="h-11 w-11 -my-2 flex items-center justify-center hover:bg-gray-100 rounded shrink-0"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <div
            {...dragHandleProps}
            data-drag-handle
            className="h-11 w-11 -my-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        </>
      )}
    </>
  );
}

/**
 * One row of the list: draggable by its handle, swipeable to reveal delete,
 * and swapped for an inline editor while being renamed.
 */
export function GroceryRow({
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
  // Checked rows can't be dragged (pointless mid-trip, avoids accidental
  // drags) — disabled here (not just handle-hidden) so it holds even if
  // something else ever renders a handle for a bought row.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: bought,
  });
  // The gesture is tracked with pointer events on the row body only — the drag
  // handle belongs to dnd-kit (its PointerSensor / TouchSensor listeners are
  // attached to the handle element exclusively, so a horizontal swipe on the
  // body can never start a drag). While dnd-kit is dragging, the transform is
  // its own — never fight it.
  const swipe = useSwipeToDelete({ locked: transform !== null });

  const setEditing = (editing: boolean) => {
    setIsEditing(editing);
    onEditingChange?.(editing);
  };

  const handleToggle = () => {
    // Tapping a row whose delete action is revealed closes it again.
    if (swipe.isOpen) {
      swipe.close();
      return;
    }
    onToggleBought();
  };

  if (isEditing) {
    return (
      <GroceryNameEditor
        name={item.name}
        onSave={(newName) => {
          onRename(newName);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const style: React.CSSProperties = {
    // Only dnd-kit's transform is set here; the swipe offset is written to the
    // node by the hook, so following a finger costs no renders at all.
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: swipe.isSwiping || isDragging ? undefined : "transform 150ms ease-out",
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <SwipeDeleteAction
        revealed={swipe.isOpen}
        revealing={swipe.isSwiping}
        hidden={isDragging}
        onDelete={() => {
          swipe.close();
          onDelete();
        }}
      />
      {/* The swipe surface. Not itself a tap target — the tick and tools inside
          are — but the click the browser fires as a swipe ends lands here, and
          is caught on the way down before any of them can take it for a tap. */}
      <div
        data-row-body
        ref={(node) => {
          swipe.setSurface(node);
          setNodeRef(node);
        }}
        style={style}
        onClickCapture={(e) => {
          if (swipe.consumeSwipeClick()) e.stopPropagation();
        }}
        {...swipe.surfaceHandlers}
        className={`
          relative flex items-center space-x-2 p-2.5 rounded-lg cursor-pointer group select-none touch-pan-y
          bg-white transition-colors active:bg-gray-100
          ${isDragging ? "opacity-0" : ""}
        `}
      >
        <GroceryRowContent
          item={item}
          bought={bought}
          onToggle={handleToggle}
          onStartEditing={() => setEditing(true)}
          dragHandleProps={{ ...listeners, ...attributes }}
        />
      </div>
    </div>
  );
}
