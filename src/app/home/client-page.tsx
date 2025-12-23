"use client";

import { Grocery, Household, Category } from "@prisma/client";
import { useEffect, useState, useRef } from "react";
import { User, House, Plus, Trash2, ShoppingBasket, Loader2, Info, LogOut } from "lucide-react";
import { getGroceryList, getCategories } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { createGroceryItem, deleteItems, updateGroceryCategory, deleteCategory } from "@/src/lib/actions";
import GroceryList from "@/src/components/house/grocery-list";
import AddCategory from "@/src/components/add-category";
import { toast } from "sonner";
import Link from "next/link";
import { signOut } from "next-auth/react";

type GroceryWithCategory = Grocery & { category: Category | null };

type HouseholdClientPageProps = {
    household: Household;
    userId: number;
};

export default function HouseholdClientPage({ household, userId }: HouseholdClientPageProps) {
    const [groceryList, setGroceryList] = useState<GroceryWithCategory[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showPersonal, setShowPersonal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [itemName, setItemName] = useState("");
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const inputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [list, cats] = await Promise.all([
                getGroceryList(household.id, userId, showPersonal),
                getCategories(household.id, userId, showPersonal),
            ]);
            setGroceryList(list as GroceryWithCategory[]);
            setCategories(cats);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Laden van gegevens mislukt");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [household.id, userId, showPersonal]);

    const removeGroceries = async () => {
        setIsPending(true);
        try {
            const deletedItems = Array.from(selectedItems);
            await deleteItems(deletedItems);
            setGroceryList((prev) => prev.filter((item) => !selectedItems.has(item.id)));
            setSelectedItems(new Set());
            toast.success(`${deletedItems.length} item${deletedItems.length === 1 ? '' : 's'} verwijderd`);
        } catch (error) {
            console.error("Error deleting items:", error);
            toast.error("Verwijderen mislukt");
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
                toast.error("Voer een itemnaam in");
                inputRef.current?.focus();
                return;
            }
            const newItem = await createGroceryItem(
                itemName,
                showPersonal ? userId : undefined,
                showPersonal ? undefined : household.id
            );
            setGroceryList([...groceryList, { ...newItem, category: null }]);
            setItemName("");
            toast.success(`"${newItem.name}" toegevoegd`);
            // Re-focus input for quick consecutive additions
            inputRef.current?.focus();
        } catch (error) {
            console.error("Failed to create grocery item:", error);
            const errorMessage = error instanceof Error ? error.message : "Toevoegen mislukt";
            toast.error(errorMessage);
        } finally {
            setIsPending(false);
        }
    };

    const handleDragEnd = async (groceryId: number, categoryId: number | null) => {
        try {
            // Find the current item to check if category actually changed
            const currentItem = groceryList.find(item => item.id === groceryId);
            if (!currentItem) return;

            // Check if category actually changed
            const categoryChanged = currentItem.categoryId !== categoryId;
            if (!categoryChanged) return; // Don't update or show toast if nothing changed

            await updateGroceryCategory(groceryId, categoryId);
            // Update local state
            setGroceryList((prev) =>
                prev.map((item) =>
                    item.id === groceryId
                        ? { ...item, categoryId, category: categories.find(c => c.id === categoryId) || null }
                        : item
                )
            );
            toast.success("Item verplaatst");
        } catch (error) {
            console.error("Failed to update category:", error);
            toast.error("Verplaatsen mislukt");
        }
    };

    const handleDeleteCategory = async (categoryId: number) => {
        try {
            await deleteCategory(categoryId);
            setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
            setGroceryList((prev) =>
                prev.map((item) =>
                    item.categoryId === categoryId ? { ...item, categoryId: null, category: null } : item
                )
            );
            toast.success("Categorie verwijderd");
        } catch (error) {
            console.error("Failed to delete category:", error);
            toast.error("Verwijderen categorie mislukt");
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
                            className="text-white hover:bg-white/20 active:bg-white/30 active:scale-95 transition-all"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                    <h2 className="text-2xl text-white font-bold tracking-wide drop-shadow-md">
                        {showPersonal ? "Persoonlijk" : household.name}
                    </h2>
                    <div className="absolute right-4">
                        <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20 active:bg-white/30 active:scale-95 transition-all">
                            <Link href="/household-info">
                                <Info className="w-5 h-5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main scrollable content area */}
            <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-6 pt-6 pb-6">
                {showPersonal && (
                    <div className="mb-4 flex justify-end">
                        <AddCategory
                            userId={userId}
                            householdId={showPersonal ? undefined : household.id}
                            showPersonal={showPersonal}
                            onCategoryAdded={fetchData}
                        />
                    </div>
                )}
                <GroceryList
                    groceryList={groceryList}
                    categories={showPersonal ? categories : []}
                    isLoading={isLoading}
                    selectedItems={selectedItems}
                    toggleSelection={toggleSelection}
                    onDragEnd={handleDragEnd}
                    onDeleteCategory={handleDeleteCategory}
                    showCategories={showPersonal}
                />
            </main>

            {/* Footer - Fixed at bottom */}
            <footer className="w-full bg-white/95 backdrop-blur-sm shadow-2xl border-t border-gray-200 px-4 pt-4 pb-6">
                <div className="relative flex flex-row justify-center items-center gap-3 w-full max-w-2xl mx-auto px-2">
                    <Input
                        ref={inputRef}
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
                        className="h-12 w-12 shadow-md hover:shadow-lg active:scale-95 transition-all"
                    >
                        {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                    </Button>

                    {/* Delete button positioned to the right of add button */}
                    {selectedItems.size > 0 && (
                        <div className="relative">
                            <Button
                                variant="destructive"
                                size="icon"
                                onClick={removeGroceries}
                                disabled={isPending}
                                className="h-12 w-12 shadow-lg hover:shadow-xl active:scale-95 transition-all animate-in fade-in zoom-in duration-200"
                            >
                                {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            </Button>
                            {/* Counter badge */}
                            <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
                                {selectedItems.size}
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative flex flex-row justify-center gap-3 pt-4 pb-2">
                    <Button
                        variant={!showPersonal ? "default" : "outline"}
                        size="lg"
                        onClick={() => setShowPersonal(false)}
                        className="min-w-[120px] shadow-md hover:shadow-lg active:scale-95 transition-all gap-2"
                    >
                        <House className="w-4 h-4" />
                        Huishouden
                    </Button>
                    <Button
                        variant={showPersonal ? "default" : "outline"}
                        size="lg"
                        onClick={() => setShowPersonal(true)}
                        className="min-w-[120px] shadow-md hover:shadow-lg active:scale-95 transition-all gap-2"
                    >
                        <User className="w-4 h-4" />
                        Persoonlijk
                    </Button>
                </div>
            </footer>
        </div>
    );
}
