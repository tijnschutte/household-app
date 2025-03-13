"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { Check, X, User, House, CircleSmall } from "lucide-react";
import { getGroceryList } from "@/app/lib/data";
import { Loader } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createGroceryItem, deleteItems } from "@/app/lib/actions";
import GroceryList from "@/app/ui/house/grocery-list";


export default function HouseholdClientPage({ household, userId }: { household: Household, userId: number }) {
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
                itemName,
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
        <main className="flex flex-col h-screen justify-center items-center overflow-x-hidden w-full font-sarif">
            {/* Top Section */}
            <div className="bg-blue-300 w-full z-10 border-b">
                <h1 className="text-center p-4 text-xl text-white font-bold">
                    {household.name}
                </h1>
            </div>
            <div className="flex justify-center items-center bg-white py-2">
                <h2 className="text-xl font-semibold">
                    {showPersonal ? "Persoonlijke boodschappen" : "Huis boodschappen"}
                </h2>
            </div>
            
            {/* Middle Section (Takes Remaining Space) */}
            <GroceryList 
                groceryList={groceryList} 
                isLoading={isLoading} 
                selectedItems={selectedItems} 
                toggleSelection={toggleSelection}
            />

            {/* Bottom Section (Always at the Bottom) */}
            <div className="w-full py-4 px-4">
                {selectedItems.size > 0 && (
                    <div className="flex justify-center items-center gap-4 p-4 w-full max-w-xl mx-auto">
                        <button className="bg-red-500 text-white px-4 py-2 rounded"
                            onClick={removeGroceries}
                            aria-disabled={isPending}
                            disabled={isPending}
                        >
                            {isPending ? <span>...</span> : <span>remove</span>}
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
                        {isPending ? <span>...</span> : <span><Check /></span>}
                    </button>
                </div>
                <div className="flex flex-row justify-center gap-4 p-4">
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