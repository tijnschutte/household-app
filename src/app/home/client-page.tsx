"use client";

import { Grocery, Household } from "@prisma/client";
import { useEffect, useReducer, useCallback } from "react";
import { User, House, Plus, Trash2, ShoppingBasket, Check, CheckCheck, MousePointerClick } from "lucide-react";
import { getGroceryList } from "@/src/lib/data";
import { Input } from "@/src/components/ui/input";
import { createGroceryItem, deleteItems, updateGroceryItem, markItemsAsBought, clearCompletedItems } from "@/src/lib/actions";
import GroceryList from "@/src/components/house/grocery-list";
import toast, { Toaster } from 'react-hot-toast';
import { useLocalStorage } from "@/src/lib/hooks/useLocalStorage";
import ErrorBoundary from "@/src/components/ErrorBoundary";

type HouseholdClientPageProps = {
    household: Household;
    userId: number;
};

type GroceryState = {
  groceryList: Grocery[];
  showPersonal: boolean;
  isLoading: boolean;
  isPending: boolean;
  itemName: string;
  selectedItems: Set<number>;
  optimisticOperations: Map<string, any>;
};

type GroceryAction = 
  | { type: 'SET_GROCERIES'; payload: Grocery[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PENDING'; payload: boolean }
  | { type: 'SET_ITEM_NAME'; payload: string }
  | { type: 'TOGGLE_PERSONAL'; payload: boolean }
  | { type: 'TOGGLE_SELECTION'; payload: number }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'ADD_ITEM'; payload: Grocery }
  | { type: 'ADD_ITEM_OPTIMISTIC'; payload: Grocery }
  | { type: 'REMOVE_ITEM_OPTIMISTIC'; payload: number }
  | { type: 'UPDATE_ITEM'; payload: { id: number; name: string } }
  | { type: 'UPDATE_ITEM_OPTIMISTIC'; payload: { id: number; name: string } }
  | { type: 'MARK_ITEMS_BOUGHT'; payload: number[] }
  | { type: 'MARK_ITEMS_BOUGHT_OPTIMISTIC'; payload: number[] }
  | { type: 'REMOVE_ITEMS'; payload: number[] }
  | { type: 'ROLLBACK_OPTIMISTIC'; payload: Grocery[] }
  | { type: 'SET_OPTIMISTIC_OP'; payload: { id: string; operation: any } }
  | { type: 'CLEAR_OPTIMISTIC_OP'; payload: string };

const groceryReducer = (state: GroceryState, action: GroceryAction): GroceryState => {
  switch (action.type) {
    case 'SET_GROCERIES':
      return { ...state, groceryList: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_PENDING':
      return { ...state, isPending: action.payload };
    case 'SET_ITEM_NAME':
      return { ...state, itemName: action.payload };
    case 'TOGGLE_PERSONAL':
      return { ...state, showPersonal: action.payload, selectedItems: new Set() };
    case 'TOGGLE_SELECTION': {
      const newSelected = new Set(state.selectedItems);
      if (newSelected.has(action.payload)) {
        newSelected.delete(action.payload);
      } else {
        newSelected.add(action.payload);
      }
      return { ...state, selectedItems: newSelected };
    }
    case 'SELECT_ALL': {
      const allIds = new Set(state.groceryList.map(item => item.id));
      return { ...state, selectedItems: allIds };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedItems: new Set() };
    case 'ADD_ITEM':
    case 'ADD_ITEM_OPTIMISTIC':
      return { 
        ...state, 
        groceryList: [...state.groceryList, action.payload],
        itemName: action.type === 'ADD_ITEM' ? '' : state.itemName
      };
    case 'UPDATE_ITEM':
    case 'UPDATE_ITEM_OPTIMISTIC':
      return {
        ...state,
        groceryList: state.groceryList.map(item => 
          item.id === action.payload.id 
            ? { ...item, name: action.payload.name }
            : item
        )
      };
    case 'MARK_ITEMS_BOUGHT':
    case 'MARK_ITEMS_BOUGHT_OPTIMISTIC':
      return {
        ...state,
        groceryList: state.groceryList.map(item => 
          action.payload.includes(item.id) 
            ? { ...item, bought: true }
            : item
        ),
        selectedItems: new Set()
      };
    case 'REMOVE_ITEMS':
    case 'REMOVE_ITEM_OPTIMISTIC':
      const idsToRemove = Array.isArray(action.payload) ? action.payload : [action.payload];
      return {
        ...state,
        groceryList: state.groceryList.filter(item => !idsToRemove.includes(item.id)),
        selectedItems: new Set()
      };
    case 'ROLLBACK_OPTIMISTIC':
      return { ...state, groceryList: action.payload };
    case 'SET_OPTIMISTIC_OP': {
      const newOps = new Map(state.optimisticOperations);
      newOps.set(action.payload.id, action.payload.operation);
      return { ...state, optimisticOperations: newOps };
    }
    case 'CLEAR_OPTIMISTIC_OP': {
      const newOps = new Map(state.optimisticOperations);
      newOps.delete(action.payload);
      return { ...state, optimisticOperations: newOps };
    }
    default:
      return state;
  }
};

const initialState: GroceryState = {
  groceryList: [],
  showPersonal: false,
  isLoading: false,
  isPending: false,
  itemName: '',
  selectedItems: new Set(),
  optimisticOperations: new Map()
};

export default function HouseholdClientPage({ household, userId }: HouseholdClientPageProps) {
    const [state, dispatch] = useReducer(groceryReducer, initialState);
    const [persistedItemName, setPersistedItemName] = useLocalStorage('grocery-input', '');
    const [persistedSelectedItems, setPersistedSelectedItems] = useLocalStorage<number[]>('selected-items', []);

    // Restore persisted state on mount
    useEffect(() => {
        if (persistedItemName) {
            dispatch({ type: 'SET_ITEM_NAME', payload: persistedItemName });
        }
        if (persistedSelectedItems.length > 0) {
            persistedSelectedItems.forEach(id => {
                dispatch({ type: 'TOGGLE_SELECTION', payload: id });
            });
        }
    }, [persistedItemName, persistedSelectedItems]);

    // Persist state changes
    useEffect(() => {
        setPersistedItemName(state.itemName);
    }, [state.itemName, setPersistedItemName]);

    useEffect(() => {
        setPersistedSelectedItems(Array.from(state.selectedItems));
    }, [state.selectedItems, setPersistedSelectedItems]);
    
    const fetchGroceries = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const list: Grocery[] = await getGroceryList(household.id, userId, state.showPersonal);
            dispatch({ type: 'SET_GROCERIES', payload: list });
        } catch (error) {
            toast.error('Failed to fetch groceries');
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [household.id, userId, state.showPersonal]);

    useEffect(() => {
        fetchGroceries();
    }, [fetchGroceries]);

    const removeGroceries = useCallback(async () => {
        dispatch({ type: 'SET_PENDING', payload: true });
        try {
            const deletedItems = Array.from(state.selectedItems);
            await deleteItems(
                deletedItems, 
                userId, 
                state.showPersonal ? undefined : household.id
            );
            dispatch({ type: 'REMOVE_ITEMS', payload: deletedItems });
            toast.success(`Deleted ${deletedItems.length} item(s)`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete items');
        } finally {
            dispatch({ type: 'SET_PENDING', payload: false });
        }
    }, [state.selectedItems, userId, household.id, state.showPersonal]);

    const toggleSelection = useCallback((id: number) => {
        dispatch({ type: 'TOGGLE_SELECTION', payload: id });
    }, []);

    const addItem = useCallback(async () => {
        const currentItemName = state.itemName.trim();
        if (!currentItemName) return;
        
        const optimisticId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticItem: Grocery = {
            id: -Math.abs(Date.now()), // Negative ID to avoid conflicts
            name: currentItemName.toLowerCase(),
            quantity: 1,
            bought: false,
            userId: state.showPersonal ? userId : null,
            householdId: state.showPersonal ? null : household.id
        };
        
        // Track the operation
        dispatch({ type: 'SET_OPTIMISTIC_OP', payload: { id: optimisticId, operation: 'add' } });
        dispatch({ type: 'ADD_ITEM_OPTIMISTIC', payload: optimisticItem });
        dispatch({ type: 'SET_ITEM_NAME', payload: '' });
        
        try {
            const newItem = await createGroceryItem(
                currentItemName,
                state.showPersonal ? userId : undefined,
                state.showPersonal ? undefined : household.id
            );
            
            // Replace optimistic item with real item
            dispatch({ type: 'REMOVE_ITEM_OPTIMISTIC', payload: optimisticItem.id });
            dispatch({ type: 'ADD_ITEM', payload: newItem });
            dispatch({ type: 'CLEAR_OPTIMISTIC_OP', payload: optimisticId });
            toast.success('Item added successfully!');
        } catch (error) {
            // Rollback optimistic update
            dispatch({ type: 'REMOVE_ITEM_OPTIMISTIC', payload: optimisticItem.id });
            dispatch({ type: 'SET_ITEM_NAME', payload: currentItemName });
            dispatch({ type: 'CLEAR_OPTIMISTIC_OP', payload: optimisticId });
            toast.error(error instanceof Error ? error.message : 'Failed to add item');
        }
    }, [state.itemName, state.showPersonal, userId, household.id]);

    const updateItem = useCallback(async (id: number, newName: string) => {
        const originalItem = state.groceryList.find(item => item.id === id);
        if (!originalItem) return;
        
        // Optimistic update
        dispatch({ type: 'UPDATE_ITEM_OPTIMISTIC', payload: { id, name: newName } });
        
        try {
            await updateGroceryItem(id, newName);
            dispatch({ type: 'UPDATE_ITEM', payload: { id, name: newName } });
            toast.success('Item updated successfully!');
        } catch (error) {
            // Rollback optimistic update
            dispatch({ type: 'UPDATE_ITEM_OPTIMISTIC', payload: { id, name: originalItem.name } });
            toast.error(error instanceof Error ? error.message : 'Failed to update item');
        }
    }, [state.groceryList]);

    const handlemarkItemsAsBought = useCallback(async () => {
        const selectedIds = Array.from(state.selectedItems);
        if (selectedIds.length === 0) return;
        
        // Optimistic update
        dispatch({ type: 'MARK_ITEMS_BOUGHT_OPTIMISTIC', payload: selectedIds });
        
        try {
            await markItemsAsBought(selectedIds);
            toast.success(`Marked ${selectedIds.length} item(s) as bought!`);
        } catch (error) {
            // Rollback optimistic update
            await fetchGroceries();
            toast.error(error instanceof Error ? error.message : 'Failed to mark items as bought');
        }
    }, [state.selectedItems]);

    const clearCompleted = useCallback(async () => {
        try {
            await clearCompletedItems(
                userId,
                state.showPersonal ? undefined : household.id
            );
            await fetchGroceries();
            toast.success('Completed items cleared!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to clear completed items');
        }
    }, [userId, household.id, state.showPersonal]);

    const selectAll = useCallback(() => {
        dispatch({ type: 'SELECT_ALL' });
        toast.success('All items selected');
    }, []);

    const handleSwipeDelete = useCallback(async (itemId: number) => {
        // Optimistic update
        dispatch({ type: 'REMOVE_ITEM_OPTIMISTIC', payload: itemId });
        
        try {
            await deleteItems(
                [itemId], 
                userId, 
                state.showPersonal ? undefined : household.id
            );
            toast.success('Item deleted!');
        } catch (error) {
            // Rollback optimistic update
            await fetchGroceries();
            toast.error(error instanceof Error ? error.message : 'Failed to delete item');
        }
    }, [userId, household.id, state.showPersonal, fetchGroceries]);

    return (
        <ErrorBoundary>
            <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Top Section */}
            <div className="sticky top-0 from-sky-950 to-sky-800 bg-gradient-to-b w-full py-4 z-20 border"> 
                {/*    */}
                <div className="flex flex-row justify-center items-center">
                    <div className="absolute left-4"><ShoppingBasket color="white" /></div>
                    <h2 className="text-2xl text-white font-semibold">
                        {state.showPersonal ? "Personal" : household.name}
                    </h2>
                </div>
            </div>

            {/* Middle Section (Takes Remaining Space) */}
            <div className="flex flex-col flex-1 min-h-0 w-full max-w-xl p-6">
                <GroceryList 
                    groceryList={state.groceryList} 
                    isLoading={state.isLoading} 
                    selectedItems={state.selectedItems} 
                    toggleSelection={toggleSelection}
                    onEdit={updateItem}
                    onSwipeDelete={handleSwipeDelete}
                />
            </div>
        
            {/* Bottom Section (Always at the Bottom) */}
            <div className="sticky bottom-0 w-full bg-white shadow-inner px-4 pt-4 z-10">
                {state.selectedItems.size > 0 && (
                    <div className="flex justify-center items-center gap-2 p-2">
                        <button 
                            className="bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:opacity-50"
                            onClick={handlemarkItemsAsBought}
                            disabled={state.isPending}
                            title="Mark as bought"
                        >
                            <Check size={16} />
                        </button>
                        <button 
                            className="bg-red-500 text-white p-2 rounded hover:bg-red-600 disabled:opacity-50"
                            onClick={removeGroceries}
                            disabled={state.isPending}
                            title="Delete selected"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
                
                {/* Bulk operation buttons */}
                <div className="flex justify-center items-center gap-2 p-2">
                    <button 
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                        onClick={selectAll}
                        disabled={state.groceryList.length === 0}
                        title="Select all items"
                    >
                        <MousePointerClick size={14} className="inline mr-1" />All
                    </button>
                    <button 
                        className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600"
                        onClick={clearCompleted}
                        disabled={!state.groceryList.some(item => item.bought)}
                        title="Clear completed items"
                    >
                        <CheckCheck size={14} className="inline mr-1" />Clear
                    </button>
                </div>
                <div className="flex flex-row justify-center items-center p-4 gap-4 w-full max-w-xl mx-auto">
                    <Input className="bg-white"
                        placeholder="Add an item"
                        value={state.itemName}
                        disabled={state.isPending}
                        onChange={(e) => dispatch({ type: 'SET_ITEM_NAME', payload: e.target.value })}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !state.isPending) {
                                addItem();
                            }
                        }}
                    />
                    <button
                        className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                        onClick={addItem}
                        aria-disabled={state.isPending}
                        disabled={state.isPending}
                    >
                        {state.isPending ? <span>...</span> : <Plus />}
                    </button>
                </div>
                <div className="relative flex flex-row justify-center gap-4 p-4">
                    {/* <SignOut /> */}
                    <button
                        className={`px-4 py-2 rounded text-black transition-colors ${
                            !state.showPersonal ? "bg-green-300" : "bg-gray-200 hover:bg-gray-300"
                        }`}
                        onClick={() => dispatch({ type: 'TOGGLE_PERSONAL', payload: false })}
                    >
                        <House />
                    </button>
                    <button
                        className={`px-4 py-2 rounded text-black transition-colors ${
                            state.showPersonal ? "bg-green-300" : "bg-gray-200 hover:bg-gray-300"
                        }`}
                        onClick={() => dispatch({ type: 'TOGGLE_PERSONAL', payload: true })}
                    >
                        <User />
                    </button>
                </div>
            </div>
            <Toaster 
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#363636',
                        color: '#fff',
                    },
                }}
            />
            </div>
        </ErrorBoundary>
    );
}
