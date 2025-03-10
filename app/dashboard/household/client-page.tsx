"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useState } from "react";
import { Check, X, User, House } from "lucide-react";
import { getGroceryList } from "@/app/lib/data";
import { Loader  } from "lucide-react";
import { Input } from "@/components/ui/input";
import { createGroceryItem } from "@/app/lib/actions";

export default function HouseholdClientPage({ household, userId } : {household : Household, userId: number}) {
    const [groceryList, setGroceryList] = useState<Grocery[]>([]);
    const [showPersonal, setShowPersonal] = useState(false); 
    const [isLoading, setIsLoading] = useState(false); 
    const [isPending, setIsPending] = useState(false);
    const [itemName, setItemName] = useState("");

    useEffect(() => {
        const fetchGroceries = async () => { 
            const list: Grocery[] = await getGroceryList(household.id, userId, showPersonal);
            setGroceryList(list);
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        fetchGroceries();
    }, [household.id, showPersonal]);

    const addItem = () => {
        const createGrocery = async () => {
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
            setIsPending(false);
            return;
        };
        setIsPending(true);
        createGrocery();
    };

    return (
        <main className="flex flex-col w-full border py-1">
            {/* Top Section */}
            <div className="flex justify-center p-4 border-b">
                <h1 className="text-xl font-bold">{household.name}'s Huis Pagina</h1>
            </div>

            {/* Middle Section (Takes Remaining Space) */}
            <div className="flex-1 overflow-auto p-4">
                <h2 className="text-lg font-semibold mb-2">
                    <span>
                        {showPersonal ? "Persoonlijke boodschappen" : "Huis boodschappen"}
                    </span>
                </h2>
                {isLoading ? (
                    <div className="flex items-center justify-center">
                        <Loader className="animate-spin size-10" />
                    </div>
                ) : (
                    <ul>
                        {groceryList.length > 0 ? (
                            groceryList.map((item) => (
                                <li key={item.id} className="border p-2 rounded my-1">
                                    - {item.name}
                                </li>
                            ))
                        ) : (
                            <p className="text-gray-500">No items found.</p>
                        )}
                    </ul>
                )}
            </div>
            <div className="flex flex-row justify-center gap-4 p-4 border-t">
                <Input
                    placeholder="Voeg een item toe"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="border p-2 rounded"
                />
                <button
                    className="border px-4 py-2 rounded active:scale-95 transition-all"
                    onClick={addItem}
                    aria-disabled={isPending}
                    disabled={isPending} // Prevent double clicks
                >
                    {isPending ? "..." : <Check />}
                </button> 
            </div>
            {/* Bottom Section (Always at the Bottom) */}
            <div className="flex flex-row justify-center gap-4 p-4 border-t">
                <button
                    className={`border px-4 py-2 rounded ${!showPersonal ? "bg-green-300" : ""}`}
                    onClick={() => setShowPersonal(false)}
                >
                    <House />
                </button>
                <button
                    className={`border px-4 py-2 rounded ${showPersonal ? "bg-green-300" : ""}`}
                    onClick={() => setShowPersonal(true)}
                >
                    <User />
                </button>
            </div>
        </main>
    );
  }


