import type { Category } from "@prisma/client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import type { GroceryWithCategory, ViewData, ViewKey } from "@/src/lib/house/grocery-view";

/**
 * Reading the list is a server action like the rest, and the page polls it.
 * Owned here so the page can hand a fake in from a test.
 */
export type GroceryViewActions = {
  onLoadData: (view: ViewKey) => Promise<ViewData>;
};

/** The two lists, one of them on screen, kept in step with the server. */
export type GroceryViews = {
  view: ViewKey;
  /** Empty while the visible list is still loading. */
  items: GroceryWithCategory[];
  categories: Category[];
  isLoading: boolean;
  /** Show the other list, loading it the first time it is opened. */
  switchView: (next: ViewKey) => void;
  /**
   * Re-read the visible list from the server. A silent refresh neither toasts
   * on failure nor overwrites an edit in flight.
   */
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  /** Apply an optimistic transform to the visible list. */
  update: (updater: (data: ViewData) => ViewData) => void;
  /** Reported by the list while a drag or inline rename is in progress. */
  setBusy: (busy: boolean) => void;
};

const POLL_INTERVAL_MS = 10_000;

export function useGroceryViews(
  initialData: ViewData,
  { onLoadData }: GroceryViewActions
): GroceryViews {
  // Both views are cached independently so toggling back and forth is instant
  // after the first visit. The household view is seeded server-side.
  const [dataByView, setDataByView] = useState<Record<ViewKey, ViewData | null>>({
    household: initialData,
    personal: null,
  });
  const [view, setView] = useState<ViewKey>("household");
  // A silent poll refresh must not clobber an in-flight edit.
  const busyRef = useRef(false);

  const fetchData = async (target: ViewKey, options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      const data = await onLoadData(target);

      // A poll finished while the user is mid-drag/mid-rename: don't clobber it.
      if (silent && busyRef.current) return;

      setDataByView((prev) => {
        const existing = prev[target];
        // Avoid a pointless re-render when nothing actually changed.
        if (existing && JSON.stringify(existing) === JSON.stringify(data)) {
          return prev;
        }
        return { ...prev, [target]: data };
      });
    } catch (error) {
      console.error("Failed to fetch data:", error);
      if (!silent) toast.error("Laden van gegevens mislukt");
    }
  };

  // Real-time sync: poll every 10s + refetch on tab focus, for the currently
  // visible view only. An Effect Event, so the timer and listener are set up
  // once and read whichever view is current when they fire.
  const refreshSilently = useEffectEvent(() => {
    fetchData(view, { silent: true });
  });
  useEffect(() => {
    const interval = setInterval(() => refreshSilently(), POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshSilently();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const switchView = (next: ViewKey) => {
    setView(next);
    if (dataByView[next] === null) fetchData(next);
  };

  const update = (updater: (data: ViewData) => ViewData) => {
    setDataByView((prev) => {
      const current = prev[view];
      if (!current) return prev;
      return { ...prev, [view]: updater(current) };
    });
  };

  const current = dataByView[view];
  return {
    view,
    items: current?.items ?? [],
    categories: current?.categories ?? [],
    isLoading: current === null,
    switchView,
    refresh: (options) => fetchData(view, options),
    update,
    setBusy: (busy) => {
      busyRef.current = busy;
    },
  };
}
