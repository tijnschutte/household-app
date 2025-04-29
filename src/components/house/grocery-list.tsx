import { Grocery } from "@prisma/client"
import { Check, CheckIcon, CheckSquare } from "lucide-react";
import { useEffect, useRef } from "react";

type GroceryListProps = {
    groceryList: Grocery[],
    isLoading: boolean,
    selectedItems: Set<number>,
    toggleSelection: (id: number) => void
}


export default function GroceryList({ 
    groceryList, 
    isLoading, 
    selectedItems, 
    toggleSelection 
} : GroceryListProps) {
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [groceryList.length]);

    const groceries = groceryList.map((item) => (
        <li
            key={item.id}
            onClick={() => toggleSelection(item.id)}
            className={`flex items-center space-x-3 p-3 rounded w-full ${selectedItems.has(item.id) ? "bg-gray-200 scale-95" : ""}`}
        >
            <div className="w-2 h-2 bg-gray-500 rounded-full flex-shrink-0"></div>
            <span className="truncate w-full text-lg min-w-0 first-letter:uppercase">
                {selectedItems.has(item.id) ? <del>{item.name}</del> : item.name}
            </span>
        </li>
    ));
    
    return (
        <ul 
            ref={listRef}
            className="flex-1 overflow-y-auto pb-24"
        >
            {isLoading && <li>Loading...</li>}
            {!isLoading && groceryList.length > 0 ? groceries : null}
        </ul>
    )
}