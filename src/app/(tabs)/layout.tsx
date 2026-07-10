import BottomTabBar from "@/src/components/bottom-tab-bar";

// Shell for all module tabs: each page fills the remaining height above the
// shared bottom tab bar. Auth/household checks stay in the pages themselves
// (layouts don't re-run on client-side navigation between sibling tabs).
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{children}</div>
      <BottomTabBar />
    </div>
  );
}
