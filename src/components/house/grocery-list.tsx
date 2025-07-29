import { Grocery } from "@prisma/client"
import { memo, useEffect, useRef, useState } from "react";
import { useSwipeable } from 'react-swipeable';
import { Edit2, Trash2 } from 'lucide-react';
import GroceryListSkeleton from '../GroceryListSkeleton';

type GroceryListProps = {
    groceryList: Grocery[],
    isLoading: boolean,
    selectedItems: Set<number>,
    toggleSelection: (id: number) => void,
    onEdit: (id: number, newName: string) => void,
    onSwipeDelete: (id: number) => void
}


const GroceryListItem = memo(({ item, isSelected, onToggle, onEdit, onSwipeDelete }: {
  item: Grocery;
  isSelected: boolean;
  onToggle: (id: number) => void;
  onEdit: (id: number, newName: string) => void;
  onSwipeDelete: (id: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.name);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (Math.abs(swipeOffset) > 100) {
        onSwipeDelete(item.id);
      }
      setSwipeOffset(0);
    },
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        setSwipeOffset(Math.max(-120, eventData.deltaX));
      }
    },
    onSwiped: () => setSwipeOffset(0),
    trackMouse: true
  });
  
  const handleEdit = () => {
    if (isEditing) {
      const trimmedValue = editValue?.trim() || '';
      if (trimmedValue && trimmedValue !== item.name && trimmedValue.length <= 100) {
        onEdit(item.id, trimmedValue);
      } else if (!trimmedValue) {
        // Reset to original value if empty
        setEditValue(item.name);
      }
    }
    setIsEditing(!isEditing);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEdit();
    } else if (e.key === 'Escape') {
      setEditValue(item.name);
      setIsEditing(false);
    }
  };
  
  return (
    <li
      {...swipeHandlers}
      className={`relative flex items-center space-x-3 p-3 rounded w-full transition-all overflow-hidden ${
        isSelected ? "bg-gray-200 scale-95" : "hover:bg-gray-50"
      }`}
      style={{ transform: `translateX(${swipeOffset}px)` }}
    >
      <div 
        className="flex items-center space-x-3 flex-1 cursor-pointer"
        onClick={() => !isEditing && onToggle(item.id)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          item.bought ? 'bg-green-500' : 'bg-gray-500'
        }`}></div>
        
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleEdit}
            className="flex-1 text-lg bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        ) : (
          <span className={`truncate w-full text-lg min-w-0 first-letter:uppercase ${
            item.bought ? 'line-through text-gray-500' : ''
          } ${
            isSelected ? 'line-through' : ''
          }`}>
            {item.name}
          </span>
        )}
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleEdit();
        }}
        className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
        title={isEditing ? "Save" : "Edit"}
      >
        <Edit2 size={14} />
      </button>
      
      {/* Swipe delete indicator */}
      {swipeOffset < -50 && (
        <div className="absolute right-0 top-0 h-full bg-red-500 flex items-center justify-center px-4 text-white">
          <Trash2 size={16} />
        </div>
      )}
    </li>
  );
});

GroceryListItem.displayName = 'GroceryListItem';

function GroceryList({ 
    groceryList, 
    isLoading, 
    selectedItems, 
    toggleSelection,
    onEdit,
    onSwipeDelete
} : GroceryListProps) {
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        // Only scroll when items are actually added (list length increases)
        const shouldScroll = groceryList.length > 0;
        if (shouldScroll && listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
            
            // Only auto-scroll if user is near the bottom
            if (isNearBottom) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
            }
        }
    }, [groceryList.length]);

    const groceries = groceryList.map((item) => (
        <GroceryListItem
            key={item.id}
            item={item}
            isSelected={selectedItems.has(item.id)}
            onToggle={toggleSelection}
            onEdit={onEdit}
            onSwipeDelete={onSwipeDelete}
        />
    ));
    
    return (
        <ul 
            ref={listRef}
            className="flex-1 overflow-y-auto pb-24"
        >
            {isLoading ? (
                <GroceryListSkeleton />
            ) : groceryList.length > 0 ? (
                groceries
            ) : (
                <li className="p-3 text-gray-500 text-center">No items yet. Add your first item!</li>
            )}
        </ul>
    )
}

export default memo(GroceryList);