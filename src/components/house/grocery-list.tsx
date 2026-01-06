"use client";

import { Grocery, Category } from "@prisma/client";
import { ShoppingCart, Trash2, Pencil, GripVertical } from "lucide-react";
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
  selectedItems: Set<number>;
  toggleSelection: (id: number) => void;
  onDragEnd: (groceryId: number, categoryId: number | null) => void;
  onDeleteCategory: (categoryId: number) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  showCategories?: boolean;
};

function DraggableGroceryItem({
  item,
  isSelected,
  onClick,
  onRename,
}: {
  item: GroceryWithCategory;
  isSelected: boolean;
  onClick: () => void;
  onRename: (newName: string) => void;
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

  const handleSave = () => {
    const trimmed = editValue.trim().slice(0, 30);
    if (trimmed && trimmed !== item.name) {
      onRename(trimmed);
    } else {
      setEditValue(item.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(item.name);
      setIsEditing(false);
    }
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  if (isEditing) {
    return (
      <div
        className="flex items-center space-x-2 p-2.5 rounded-lg bg-white border-2 border-blue-400 shadow-md"
      >
        <div className="w-5 h-5 flex-shrink-0" />
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
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`
        flex items-center space-x-2 p-2.5 rounded-lg cursor-pointer group select-none
        ${
          isSelected
            ? "bg-green-50 border-2 border-green-300 shadow-sm scale-[0.98]"
            : "bg-white border-2 border-transparent shadow-md hover:shadow-lg hover:scale-[1.02]"
        }
        ${isDragging ? "opacity-0" : "transition-all duration-100 ease-in-out"}
      `}
    >
      <div
        {...listeners}
        {...attributes}
        className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <span
        className={`
          truncate w-full text-base min-w-0 first-letter:uppercase transition-all duration-100
          ${isSelected ? "text-gray-500 line-through" : "text-gray-800 font-medium"}
        `}
      >
        {item.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <Pencil className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
}

function UncategorizedItems({
  items,
  selectedItems,
  toggleSelection,
  onRenameItem,
}: {
  items: GroceryWithCategory[];
  selectedItems: Set<number>;
  toggleSelection: (id: number) => void;
  onRenameItem: (groceryId: number, newName: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: "uncategorized" });

  return (
    <div ref={setNodeRef} className="space-y-2 min-h-[60px] p-3 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/30">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-2">
          Sleep items hierheen om uit categorie te halen
        </p>
      ) : (
        items.map((item) => (
          <DraggableGroceryItem
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            onClick={() => toggleSelection(item.id)}
            onRename={(newName) => onRenameItem(item.id, newName)}
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
  selectedItems,
  toggleSelection,
  onDelete,
  onRenameItem,
  isUncategorized = false,
}: {
  id: string;
  title: string;
  items: GroceryWithCategory[];
  selectedItems: Set<number>;
  toggleSelection: (id: number) => void;
  onDelete?: () => void;
  onRenameItem: (groceryId: number, newName: string) => void;
  isUncategorized?: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 p-3 rounded-lg ${
        isUncategorized
          ? "bg-gray-50/50"
          : "bg-blue-50/30 border border-blue-100"
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
          <p className="text-sm text-gray-400 italic px-2 py-4 text-center">
            Sleep items hierheen
          </p>
        ) : (
          items.map((item) => (
            <DraggableGroceryItem
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onClick={() => toggleSelection(item.id)}
              onRename={(newName) => onRenameItem(item.id, newName)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function GroceryList({
  groceryList,
  categories,
  isLoading,
  selectedItems,
  toggleSelection,
  onDragEnd,
  onDeleteCategory,
  onRenameItem,
  showCategories = true,
}: GroceryListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [groceryList.length]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

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

  // Group items by category
  const uncategorizedItems = groceryList.filter((item) => !item.categoryId);
  const categorizedItems = categories.map((category) => ({
    category,
    items: groceryList.filter((item) => item.categoryId === category.id),
  }));
  // Don't filter out empty categories - show all categories

  const activeItem = groceryList.find((item) => item.id === activeDragId);

  if (!isMounted) {
    return (
      <div ref={listRef} className="w-full space-y-6">
        <div className="flex items-center justify-center p-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Render list content (common for both draggable and non-draggable modes)
  const renderContent = () => (
    <div ref={listRef} className="w-full space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center p-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
        <>
          {/* Categorized Sections - Show all categories, even empty ones */}
          {showCategories && categorizedItems.map(({ category, items }) => (
            <DroppableCategory
              key={category.id}
              id={`category-${category.id}`}
              title={category.name}
              items={items}
              selectedItems={selectedItems}
              toggleSelection={toggleSelection}
              onDelete={() => onDeleteCategory(category.id)}
              onRenameItem={onRenameItem}
            />
          ))}

          {/* Uncategorized Section - at the bottom, without title - only show when categories are enabled and there are items or categories */}
          {showCategories && (uncategorizedItems.length > 0 || categories.length > 0) && (
            <UncategorizedItems
              items={uncategorizedItems}
              selectedItems={selectedItems}
              toggleSelection={toggleSelection}
              onRenameItem={onRenameItem}
            />
          )}

          {/* Simple list when categories are disabled */}
          {!showCategories && uncategorizedItems.length > 0 && (
            <div className="space-y-2">
              {uncategorizedItems.map((item) => (
                <DraggableGroceryItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.has(item.id)}
                  onClick={() => toggleSelection(item.id)}
                  onRename={(newName) => onRenameItem(item.id, newName)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // When categories are disabled, render simple list without DndContext
  if (!showCategories) {
    return renderContent();
  }

  // When categories are enabled, wrap in DndContext for drag-and-drop
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
      {renderContent()}

      <DragOverlay>
        {activeItem ? (
          <div className="bg-white border-2 border-blue-500 shadow-2xl p-2.5 rounded-lg opacity-90">
            <span className="text-base font-medium first-letter:uppercase">
              {activeItem.name}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
