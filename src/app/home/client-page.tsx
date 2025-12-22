"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { Check, X, User, House, CircleSmall, ArrowLeft, Plus, Trash2, Minus, Trash, ShoppingBasket, Loader2, Info, LogOut } from "lucide-react";
import { getGroceryList } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { createGroceryItem, deleteItems } from "@/src/lib/actions";
import GroceryList from "@/src/components/house/grocery-list";
import { SheetFooter } from "@/src/components/ui/sheet";
import { toast } from "sonner";
import Link from "next/link";
import { signOut } from "next-auth/react";

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
                toast.error("Failed to load your grocery list");
            } finally {
                setIsLoading(false);
            }
        };
        fetchGroceries();
    }, [household.id, userId, showPersonal]);

    const removeGroceries = async () => {
        setIsPending(true);
        try {
            const deletedItems = Array.from(selectedItems);
            await deleteItems(deletedItems);
            setGroceryList((prev) => prev.filter((item) => !selectedItems.has(item.id)));
            setSelectedItems(new Set());
            toast.success(`Deleted ${deletedItems.length} item${deletedItems.length === 1 ? '' : 's'}`);
        } catch (error) {
            console.error("Error deleting items:", error);
            toast.error("Failed to delete items");
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
                toast.error("Please enter an item name");
                return;
            }
            const newItem = await createGroceryItem(
                itemName,
                showPersonal ? userId : undefined,
                showPersonal ? undefined : household.id
            );
            setGroceryList([...groceryList, newItem]);
            setItemName("");
            toast.success(`Added "${newItem.name}"`);
        } catch (error) {
            console.error("Failed to create grocery item:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to add item";
            toast.error(errorMessage);
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header - Fixed at top */}
            <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 w-full py-6 shadow-lg">
                <div className="flex flex-row justify-center items-center relative px-4">
                    <div className="absolute left-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => signOut()}
                            className="text-white hover:bg-white/20"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                    <h2 className="text-2xl text-white font-bold tracking-wide drop-shadow-md">
                        {showPersonal ? "Persoonlijk" : household.name}
                    </h2>
                    <div className="absolute right-4">
                        <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                            <Link href="/household-info">
                                <Info className="w-5 h-5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main scrollable content area */}
            <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-6 pt-6 pb-6">
                <GroceryList
                    groceryList={groceryList}
                    isLoading={isLoading}
                    selectedItems={selectedItems}
                    toggleSelection={toggleSelection}
                />
            </main>

            {/* Footer - Fixed at bottom */}
            <footer className="w-full bg-white/95 backdrop-blur-sm shadow-2xl border-t border-gray-200 px-4 pt-4 pb-6">
                <div className="relative flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto px-2">
                    <Input
                        className="bg-white shadow-md border-2 border-gray-200 focus:border-blue-500 transition-colors h-12 text-base"
                        placeholder="Voeg een item toe..."
                        value={itemName}
                        disabled={isPending}
                        onChange={(e) => setItemName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !isPending) {
                                addItem();
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        onClick={addItem}
                        onKeyDown={(e) => {if (e.key === "Enter" && !isPending) {addItem();}}}
                        disabled={isPending}
                        className="h-12 w-12 shadow-md hover:shadow-lg transition-all"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    </Button>

                    {/* Delete button positioned to the right of add button */}
                    {selectedItems.size > 0 && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={removeGroceries}
                            disabled={isPending}
                            className="h-12 w-12 shadow-lg hover:shadow-xl transition-all animate-in fade-in zoom-in duration-200"
                        >
                            {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </Button>
                    )}
                </div>
                <div className="relative flex flex-row justify-center gap-3 pt-4 pb-2">
                    <Button
                        variant={!showPersonal ? "default" : "outline"}
                        size="lg"
                        onClick={() => setShowPersonal(false)}
                        className="min-w-[120px] shadow-md hover:shadow-lg transition-all gap-2"
                    >
                        <House className="w-4 h-4" />
                        Huishouden
                    </Button>
                    <Button
                        variant={showPersonal ? "default" : "outline"}
                        size="lg"
                        onClick={() => setShowPersonal(true)}
                        className="min-w-[120px] shadow-md hover:shadow-lg transition-all gap-2"
                    >
                        <User className="w-4 h-4" />
                        Persoonlijk
                    </Button>
                </div>
            </footer>
        </div>
    );
}
