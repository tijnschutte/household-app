import { Grocery } from "@prisma/client"
import { Check, CheckIcon, CheckSquare, ShoppingCart } from "lucide-react";
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

    const groceries = groceryList.map((item, index) => (
        <li
            key={item.id}
            onClick={() => toggleSelection(item.id)}
            className={`
                flex items-center space-x-3 p-4 rounded-xl cursor-pointer
                transition-all duration-200 ease-in-out
                ${index < groceryList.length - 1 ? 'mb-3' : 'mb-0'}
                ${selectedItems.has(item.id)
                    ? "bg-green-50 border-2 border-green-300 shadow-sm scale-[0.98]"
                    : "bg-white border-2 border-transparent shadow-md hover:shadow-lg hover:scale-[1.02]"
                }
            `}
        >
            <div className={`
                w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors
                ${selectedItems.has(item.id)
                    ? "bg-green-500 border-green-600"
                    : "border-gray-300 bg-gray-50"
                }
            `}>
                {selectedItems.has(item.id) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <span className={`
                truncate w-full text-lg min-w-0 first-letter:uppercase transition-all
                ${selectedItems.has(item.id) ? "text-gray-500 line-through" : "text-gray-800 font-medium"}
            `}>
                {item.name}
            </span>
        </li>
    ));

    return (
        <ul
            ref={listRef}
            className="w-full"
        >
            {isLoading && (
                <li className="flex items-center justify-center p-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </li>
            )}
            {!isLoading && groceryList.length === 0 && (
                <li className="flex flex-col items-center justify-center p-12 text-gray-400">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">Geen items</p>
                    <p className="text-sm mt-1">Voeg je eerste item toe!</p>
                </li>
            )}
            {!isLoading && groceryList.length > 0 ? groceries : null}
        </ul>
    )
}