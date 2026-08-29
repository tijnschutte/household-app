import { requireMembership } from "@/src/lib/membership/gate";
import { getHomeData } from "@/src/lib/house/data";
import HouseholdClientPage, { type HomeActions } from "./client-page";
import type { ViewKey } from "@/src/lib/house/grocery-view";
import {
  createCategory,
  createGroceryItem,
  deleteCategory,
  deleteItems,
  restoreItems,
  setGroceryBought,
  updateGroceryCategory,
  updateGroceryName,
} from "@/src/lib/house/actions";
import { getRecipesForListMatch } from "@/src/lib/recepten/data";

// The composition root for the home page: the only place that knows which
// server action backs each operation the UI offers — and the only place that
// translates the screen's vocabulary ("which list am I on") into the scoping
// flag the database layer wants.
//
// Every entry below must be a server action, not a closure over one. A prop
// crossing into a Client Component is serialized, and only a "use server"
// function has anything to serialize — an id the browser can call back. A
// plain arrow here has none, and React refuses to render the whole tree
// ("Event handlers cannot be passed to Client Component props"), which is why
// the wrappers that translate ViewKey carry the directive themselves.
const isPersonal = (view: ViewKey) => view === "personal";

const homeActions: HomeActions = {
  onLoadData: async (view) => {
    "use server";
    return getHomeData(isPersonal(view));
  },
  onCreateItem: async (name, view, categoryId) => {
    "use server";
    return createGroceryItem(name, isPersonal(view), categoryId);
  },
  onSetBought: setGroceryBought,
  onDeleteItems: deleteItems,
  onRestoreItems: restoreItems,
  onUpdateItemCategory: updateGroceryCategory,
  onRenameItem: updateGroceryName,
  onDeleteCategory: deleteCategory,
  onCreateCategory: async (name, view) => {
    "use server";
    return createCategory(name, isPersonal(view));
  },
  onLoadRecipesForMatch: async () => {
    "use server";
    return getRecipesForListMatch();
  },
};

export default async function Page() {
  const { household } = await requireMembership();
  const initialData = await getHomeData(false);

  return (
    <HouseholdClientPage
      householdId={household.id}
      initialData={initialData}
      actions={homeActions}
    />
  );
}
