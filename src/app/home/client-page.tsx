"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { Check, X, User, House, CircleSmall, ArrowLeft, Plus, Trash2, Minus, Trash, ShoppingBasket } from "lucide-react";
import { getGroceryList } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { createGroceryItem, deleteItems } from "@/src/lib/actions";
import GroceryList from "@/src/components/house/grocery-list";

type HouseholdClientPageProps = {
    household: Household;
    userId: number;
};

export default function HouseholdClientPage({ household, userId }: HouseholdClientPageProps) {
    const [groceryList, setGroceryList] = useState<Grocery[]>(() => []);
    const [showPersonal, setShowPersonal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [itemName, setItemName] = useState("");
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    
    useEffect(() => {
        const fetchGroceries = async () => {
            setIsLoading(true); 
            try {
                const list: Grocery[] = await getGroceryList(household.id, userId, showPersonal);
                setGroceryList(list);
            } catch (error) {
                console.error("Failed to fetch groceries:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGroceries();
    }, [household.id, userId, showPersonal]);

    const removeGroceries = async () => {
        setIsPending(true);
        try {
            const deletedItems = Array.from(selectedItems)
            await deleteItems(deletedItems)
            setGroceryList((prev) => prev.filter((item) => !selectedItems.has(item.id)));
            setSelectedItems(new Set());
            console.log("Deleted items:", deletedItems);
        } catch (error) {
            console.error("Error deleting items:", error);
        } finally {
            setIsPending(false); 
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedItems((prev) => {
            const newSelected = new Set(prev); 
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return newSelected; 
        });
    };

    const addItem = async () => {
        setIsPending(true);
        try {
            if (!itemName.trim()) {
                return;
            }
            const newItem = await createGroceryItem(
                itemName.toLowerCase(),
                showPersonal ? userId : undefined,
                showPersonal ? undefined : household.id
            );
            setGroceryList([...groceryList, newItem]);
            setItemName("");
        } catch (error) {
            console.error("Failed to create grocery item:", error);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <main className="flex flex-col w-full h-screen pb-24">
            {/* Top Section */}
            <div className="flex flex-col justify-end from-sky-950 to-sky-800 bg-gradient-to-b w-full py-4">
                <div className="flex flex-row justify-center items-center">
                    <div className="absolute left-4"><ShoppingBasket color="white"/></div>
                    <h2 className="text-2xl text-white font-semibold">
                        {showPersonal ? "Persoonlijk" : household.name}
                    </h2>
                </div>
            </div>

            {/* Middle Section (Takes Remaining Space) */}
            <div className="w-full flex-1 overflow-y-auto">
                <GroceryList 
                    groceryList={groceryList} 
                    isLoading={isLoading} 
                    selectedItems={selectedItems} 
                    toggleSelection={toggleSelection}
                />
            </div>

            {/* Bottom Section (Always at the Bottom) */}
            <div className="w-full pb-4 px-4">
                {selectedItems.size > 0 && (
                    <div className="flex justify-center items-center gap-4 p-4 w-full max-w-xl mx-auto">
                        <button className="bg-red-500 text-white px-4 py-2 rounded"
                            onClick={removeGroceries}
                            aria-disabled={isPending}
                            disabled={isPending}
                        >
                            {isPending ? <span>...</span> : <Trash2 />}
                        </button>
                    </div>
                )}
                <div className="flex flex-row justify-center items-center gap-4 p-4 w-full max-w-xl mx-auto">
                    <Input className="bg-white"
                        placeholder="Voeg een item toe"
                        value={itemName}
                        disabled={isPending}
                        onChange={(e) => setItemName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !isPending) {
                                addItem();
                            }
                        }}
                    />
                    <button
                        onClick={addItem}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !isPending) {
                                addItem();
                            }
                        }}
                        aria-disabled={isPending}
                        disabled={isPending}
                    >
                        {isPending ? <span>...</span> : <span><Plus /></span>}
                    </button>
                </div>
                <div className="relative flex flex-row justify-center gap-4 p-4">
                    {/* <SignOut /> */}
                    <button
                        className={`px-4 py-2 rounded text-black ${!showPersonal ? "bg-green-300" : "bg-gray-200"}`}
                        onClick={() => setShowPersonal(false)}
                    >
                        <House />
                    </button>
                    <button
                        className={`px-4 py-2 rounded text-black ${showPersonal ? "bg-green-300" : "bg-gray-200"}`}
                        onClick={() => setShowPersonal(true)}
                    >
                        <User />
                    </button>
                </div>
            </div>
        </main>
    );
}
