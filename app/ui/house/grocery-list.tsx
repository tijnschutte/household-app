import { Grocery } from "@prisma/client"
import { CircleSmall, Loader } from "lucide-react"
import { useEffect, useRef } from "react";

export default function GroceryList({ 
    groceryList, 
    isLoading, 
    selectedItems, 
    toggleSelection 
} : { 
    groceryList: Grocery[], 
    isLoading: boolean, 
    selectedItems: Set<number>, 
    toggleSelection: (id: number) => void 
}) {
    const listRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [groceryList.length]);
    
    return (
        <div className="flex-1 flex-col-reverse mx-auto max-w-xl w-full px-6 p-6 overflow-x-hidden">
            <ul 
                className="overflow-y-auto overflow-x-hidden max-h-96"
                // className="overflow-x-hidden"
                style={{ scrollBehavior: "smooth" }}
                ref={listRef}
            >
                {isLoading && <li><Loader className="animate-spin size-10" /></li>}
                {!isLoading && groceryList.length > 0 ? (
                    groceryList.map((item) => (
                        <li
                            key={item.id}
                            onClick={() => toggleSelection(item.id)}
                            className={`flex items-center space-x-3 p-2 rounded w-full ${selectedItems.has(item.id) ? "bg-gray-200 scale-95" : ""}`}
                        >
                            <CircleSmall size={20} strokeWidth={1.75} />
                            <span className={`truncate w-full min-w-0 ${selectedItems.has(item.id) ? "line-through" : ""}`}>
                                {item.name}
                            </span>
                        </li>
                    ))
                ) : (
                    !isLoading &&
                    <li className="text-gray-500">
                        No items found.
                    </li>
                )}
            </ul>
        </div>
    )
}