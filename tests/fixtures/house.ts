/**
 * Builders for the boodschappenlijst shapes. A test states only the fields it
 * is about; everything else gets a neutral default.
 */

import type { Category, Grocery } from "@prisma/client";
import type { GroceryWithCategory, ViewData } from "@/src/lib/house/grocery-view";

export function aCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: "Zuivel",
    householdId: 1,
    userId: null,
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  };
}

export function aGrocery(overrides: Partial<GroceryWithCategory> = {}): GroceryWithCategory {
  return {
    id: 1,
    name: "melk",
    quantity: null,
    unit: null,
    bought: false,
    householdId: 1,
    userId: null,
    categoryId: null,
    category: null,
    sourceRecipeTitle: null,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  };
}

export function aViewData(overrides: Partial<ViewData> = {}): ViewData {
  return { items: [], categories: [], ...overrides };
}

/**
 * What `createGroceryItem` actually hands back: the raw row, not the joined
 * `GroceryWithCategory` shape the screen renders — the caller adds `category`
 * itself from what it already knows locally (client-page.tsx's addItem).
 */
export function aGroceryRow(
  overrides: Partial<Omit<Grocery, "quantity"> & { quantity: number | null }> = {}
): Omit<Grocery, "quantity"> & { quantity: number | null } {
  return {
    id: 1,
    name: "melk",
    quantity: null,
    unit: null,
    bought: false,
    householdId: 1,
    userId: null,
    categoryId: null,
    sourceRecipeId: null,
    createdAt: new Date("2026-07-01T12:00:00Z"),
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    ...overrides,
  };
}
