"use client";

import { Grocery, Category } from "@prisma/client";
import {
  ShoppingCart,
  Trash2,
  Pencil,
  GripVertical,
  Check,
  ChevronDown,
  Loader2,
} from "lucide-react";
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

type GroceryWithCategory = Grocery & { category: Category | null };

type GroceryListProps = {
  groceryList: GroceryWithCategory[];
  categories: Category[];
  isLoading: boolean;
  onToggleBought: (id: number, bought: boolean) => void;
  onDragEnd: (groceryId: number, categoryId: number | null) => void;
  onDeleteCategory: (categoryId: number) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onClearBought: () => void;
  isClearingBought?: boolean;
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
        w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors
        ${bought ? "bg-blue-600 border-blue-600" : "border-gray-300"}
      `}
    >
      {bought && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
    </div>
  );
}

function DraggableGroceryItem({
  item,
  onToggleBought,
  onRename,
  onEditingChange,
}: {
  item: GroceryWithCategory;
  onToggleBought: () => void;
  onRename: (newName: string) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });

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

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-white border-2 border-blue-400 shadow-md">
        <div className="w-6 h-6 flex-shrink-0" />
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
    <div
      ref={setNodeRef}
      style={style}
      onClick={onToggleBought}
      className={`
        flex items-center space-x-2 p-2.5 rounded-lg cursor-pointer group select-none
        bg-white border-2 border-transparent shadow-md hover:shadow-lg
        ${isDragging ? "opacity-0" : "transition-all duration-100 ease-in-out"}
      `}
    >
      <CheckCircle bought={false} />
      <span className="truncate w-full text-base min-w-0 first-letter:uppercase text-gray-800 font-medium">
        {item.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          startEditing();
        }}
        className="h-11 w-11 -my-2 flex items-center justify-center hover:bg-gray-100 rounded shrink-0"
      >
        <Pencil className="w-3.5 h-3.5 text-gray-400" />
      </button>
      <div
        {...listeners}
        {...attributes}
        className="h-11 w-11 -my-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
    </div>
  );
}

// A checked-off item rendered inside the collapsed "Afgevinkt" section: no
// drag handle, no rename affordance — just struck-through, muted, tap to
// restore (un-check). categoryId is left untouched while bought, so unchecking
// puts the item straight back into its old category group.
function CheckedGroceryItem({
  item,
  onToggleBought,
}: {
  item: GroceryWithCategory;
  onToggleBought: () => void;
}) {
  return (
    <div
      onClick={onToggleBought}
      className="flex items-center space-x-2 p-2.5 rounded-lg cursor-pointer select-none bg-white/60 border-2 border-transparent"
    >
      <CheckCircle bought />
      <span className="truncate w-full text-base min-w-0 first-letter:uppercase text-gray-400 line-through">
        {item.name}
      </span>
    </div>
  );
}

function UncategorizedItems({
  items,
  onToggleBought,
  onRenameItem,
  onItemEditingChange,
}: {
  items: GroceryWithCategory[];
  onToggleBought: (id: number) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onItemEditingChange?: (id: number, editing: boolean) => void;
}) {
  const { setNodeRef } = useDroppable({ id: "uncategorized" });

  return (
    <div
      ref={setNodeRef}
      className="space-y-2 min-h-[60px] p-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/30"
    >
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-2">
          Sleep items hierheen om uit categorie te halen
        </p>
      ) : (
        items.map((item) => (
          <DraggableGroceryItem
            key={item.id}
            item={item}
            onToggleBought={() => onToggleBought(item.id)}
            onRename={(newName) => onRenameItem(item.id, newName)}
            onEditingChange={(editing) => onItemEditingChange?.(item.id, editing)}
          />
        ))
      )}
    </div>
  );
}

function DroppableCategory({
  id,
  title,
  items,
  onToggleBought,
  onDelete,
  onRenameItem,
  onItemEditingChange,
  isUncategorized = false,
}: {
  id: string;
  title: string;
  items: GroceryWithCategory[];
  onToggleBought: (id: number) => void;
  onDelete?: () => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  onItemEditingChange?: (id: number, editing: boolean) => void;
  isUncategorized?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 p-3 rounded-lg ${
        isUncategorized ? "bg-gray-50/50" : "bg-blue-50/30 border border-blue-100"
      }`}
    >
      <div className="flex items-center justify-between px-2">
        <h3
          className={`text-sm font-semibold uppercase tracking-wide ${
            isUncategorized ? "text-gray-600" : "text-blue-900"
          }`}
        >
          {title}
        </h3>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-2 py-4 text-center">Sleep items hierheen</p>
        ) : (
          items.map((item) => (
            <DraggableGroceryItem
              key={item.id}
              item={item}
              onToggleBought={() => onToggleBought(item.id)}
              onRename={(newName) => onRenameItem(item.id, newName)}
              onEditingChange={(editing) => onItemEditingChange?.(item.id, editing)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Collapsed-by-default section for checked-off items, sunk to the very
// bottom of the list. Expand/collapse is local UI state, never persisted.
function CheckedSection({
  items,
  onToggleBought,
  onClear,
  isClearing,
}: {
  items: GroceryWithCategory[];
  onToggleBought: (id: number) => void;
  onClear: () => void;
  isClearing: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="pt-2">
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center justify-between w-full min-h-11 px-2 py-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
      >
        <span>Afgevinkt ({items.length})</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="space-y-2 mt-1">
          {items.map((item) => (
            <CheckedGroceryItem
              key={item.id}
              item={item}
              onToggleBought={() => onToggleBought(item.id)}
            />
          ))}
          <Button
            variant="ghost"
            onClick={onClear}
            disabled={isClearing}
            className="w-full h-11 mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isClearing && <Loader2 className="w-4 h-4 animate-spin" />}
            Wis afgevinkte items ({items.length})
          </Button>
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
  onClearBought,
  isClearingBought = false,
  showCategories = true,
  busyRef,
}: GroceryListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
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

  // Checked-off items leave their category groups entirely and render in a
  // single collapsed section at the bottom, most-recently-checked first.
  const uncheckedItems = groceryList.filter((item) => !item.bought);
  const checkedItems = groceryList
    .filter((item) => item.bought)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Group unchecked items by category
  const uncategorizedItems = uncheckedItems.filter((item) => !item.categoryId);
  const categorizedItems = categories.map((category) => ({
    category,
    items: uncheckedItems.filter((item) => item.categoryId === category.id),
  }));
  // Don't filter out empty categories - show all categories

  const activeItem = groceryList.find((item) => item.id === activeDragId);

  // Render list content (common for both draggable and non-draggable modes)
  const renderContent = () => (
    <div ref={listRef} className="w-full space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!isLoading &&
        uncheckedItems.length === 0 &&
        checkedItems.length === 0 &&
        categories.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-400">
            <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Geen items</p>
            <p className="text-sm mt-1">Voeg je eerste item toe!</p>
          </div>
        )}

      {!isLoading && (
        <>
          {/* Categorized Sections - Show all categories, even empty ones */}
          {showCategories &&
            categorizedItems.map(({ category, items }) => (
              <DroppableCategory
                key={category.id}
                id={`category-${category.id}`}
                title={category.name}
                items={items}
                onToggleBought={(id) => onToggleBought(id, true)}
                onDelete={() => onDeleteCategory(category.id)}
                onRenameItem={onRenameItem}
                onItemEditingChange={handleItemEditingChange}
              />
            ))}

          {/* Uncategorized Section - at the bottom, without title - only show when categories are enabled and there are items or categories */}
          {showCategories && (uncategorizedItems.length > 0 || categories.length > 0) && (
            <UncategorizedItems
              items={uncategorizedItems}
              onToggleBought={(id) => onToggleBought(id, true)}
              onRenameItem={onRenameItem}
              onItemEditingChange={handleItemEditingChange}
            />
          )}

          {/* Simple list when categories are disabled */}
          {!showCategories && uncategorizedItems.length > 0 && (
            <div className="space-y-2">
              {uncategorizedItems.map((item) => (
                <DraggableGroceryItem
                  key={item.id}
                  item={item}
                  onToggleBought={() => onToggleBought(item.id, true)}
                  onRename={(newName) => onRenameItem(item.id, newName)}
                  onEditingChange={(editing) => handleItemEditingChange(item.id, editing)}
                />
              ))}
            </div>
          )}

          <CheckedSection
            items={checkedItems}
            onToggleBought={(id) => onToggleBought(id, false)}
            onClear={onClearBought}
            isClearing={isClearingBought}
          />
        </>
      )}
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
          <div className="bg-white border-2 border-blue-500 shadow-2xl p-2.5 rounded-lg opacity-90">
            <span className="text-base font-medium first-letter:uppercase">{activeItem.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
