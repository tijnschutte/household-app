import BottomTabBar from "@/src/components/bottom-tab-bar";
import { getHiddenModules } from "@/src/lib/modules/actions";

// Shell for all module tabs: each page fills the remaining height above the
// shared bottom tab bar. Auth/household checks stay in the pages themselves
// (layouts don't re-run on client-side navigation between sibling tabs) —
// which is also why switching a tab off calls router.refresh(): nothing else
// re-renders this.
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const hiddenModules = await getHiddenModules();

  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <BottomTabBar hiddenModules={hiddenModules} />
    </div>
  );
}
