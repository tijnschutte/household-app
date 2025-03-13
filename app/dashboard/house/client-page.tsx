"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useState } from "react";
import { Check, X, User, House, CircleSmall } from "lucide-react";
import { getGroceryList } from "@/app/lib/data";
import { Loader } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createGroceryItem } from "@/app/lib/actions";

export default function HouseholdClientPage({ household, userId }: { household: Household, userId: number }) {
    const [groceryList, setGroceryList] = useState<Grocery[]>(() => []);
    const [showPersonal, setShowPersonal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [itemName, setItemName] = useState("");
    const [selectedItems, setSelectedItems] = useState<{ [key: number]: boolean }>({});

    const toggleItem = (id: number) => {
        setSelectedItems((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    useEffect(() => {
        const fetchGroceries = async () => {
            const list: Grocery[] = await getGroceryList(household.id, userId, showPersonal);
            setGroceryList(list);
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        fetchGroceries();
    }, [household.id, userId, showPersonal]);

    const addItem = () => {
        const createGrocery = async () => {
            try {
                if (!itemName.trim()) {
                    setIsPending(false);
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

        setIsPending(true);
        createGrocery();
    };

    return (
        <main className="flex flex-col h-screen justify-center items-center overflow-x-hidden w-full font-sarif">
            {/* Top Section */}
            <div className="bg-red-300 w-full z-10 border-b">
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
            <div className="flex-1 mx-auto max-w-xl w-full px-6 p-6 overflow-x-hidden">
                <ul className="overflow-x-hidden">
                    {isLoading && <li><Loader className="animate-spin size-10" /></li>}
                    {!isLoading && groceryList.length > 0 ? (
                        groceryList.map((item) => (
                            <li
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                className={`flex items-center space-x-3 p-2 rounded w-full ${selectedItems[item.id] ? "bg-gray-200 scale-95" : ""}`}
                            >
                                <CircleSmall size={20} strokeWidth={1.75} />
                                <span className={`truncate w-full min-w-0 ${selectedItems[item.id] ? "line-through" : ""}`}>
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

            {/* Bottom Section (Always at the Bottom) */}
            <div className="w-full py-4 px-4">
                <div className="flex flex-row justify-center items-center gap-4 p-4 w-full max-w-xl mx-auto">
                    <Input className="bg-white"
                        placeholder="Voeg een item toe"
                        value={itemName}
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