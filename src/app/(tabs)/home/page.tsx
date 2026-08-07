"use server";

import { getHouseholdById, getHomeData } from "@/src/lib/data";
import { redirect } from "next/navigation";
import HouseholdClientPage, { type HomeActions } from "./client-page";
import { auth } from "@/src/lib/auth";
import {
  createCategory,
  createGroceryItem,
  deleteCategory,
  deleteItems,
  restoreItems,
  setGroceryBought,
  updateGroceryCategory,
  updateGroceryName,
} from "@/src/lib/actions";

// The composition root for the home page: the only place that knows which
// server action backs each operation the UI offers.
const homeActions: HomeActions = {
  onLoadData: getHomeData,
  onCreateItem: createGroceryItem,
  onSetBought: setGroceryBought,
  onDeleteItems: deleteItems,
  onRestoreItems: restoreItems,
  onUpdateItemCategory: updateGroceryCategory,
  onRenameItem: updateGroceryName,
  onDeleteCategory: deleteCategory,
  onCreateCategory: createCategory,
};

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  const household = await getHouseholdById(Number(session.user?.id));
  if (!household) {
    redirect("/household-setup");
  }
  const initialData = await getHomeData(false);

  return (
    <HouseholdClientPage household={household} initialData={initialData} actions={homeActions} />
  );
}
