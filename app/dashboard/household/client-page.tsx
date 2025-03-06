"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { getGroceryList } from "@/app/lib/data";
import { Loader  } from "lucide-react";

export default function HouseholdClientPage({ household } : {household : Household}) {
    const [groceryList, setGroceryList] = useState<Grocery[]>([]);
    const [showBought, setShowBought] = useState(false); 
    const [isLoading, setIsLoading] = useState(false); 

    useEffect(() => {
        const fetchGroceries = async () => { 
            const list: Grocery[] = await getGroceryList(household.id, showBought);
            setGroceryList(list);
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        fetchGroceries();
    }, [household.id, showBought]);

    return (
        <main className="flex flex-col w-full border py-1">
            {/* Top Section */}
            <div className="flex justify-center p-4 border-b">
                <h1 className="text-xl font-bold">{household.name}'s Household Page</h1>
            </div>

            {/* Middle Section (Takes Remaining Space) */}
            <div className="flex-1 overflow-auto p-4 bg-white">
                <h2 className="text-lg font-semibold mb-2">
                    Wat hebben we{" "}
                    <span className={showBought ? "text-green-500" : "text-red-500"}>
                        {showBought ? "WEL" : "NIET"}
                    </span>
                    ?
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

            {/* Bottom Section (Always at the Bottom) */}
            <div className="flex flex-row justify-center gap-4 p-4 border-t">
                <button
                    className={`border px-4 py-2 rounded ${!showBought ? "bg-red-300" : ""}`}
                    onClick={() => setShowBought(false)}
                >
                    <X />
                </button>
                <button
                    className={`border px-4 py-2 rounded ${showBought ? "bg-green-300" : ""}`}
                    onClick={() => setShowBought(true)}
                >
                    <Check />
                </button>
            </div>
        </main>
    );
  }


