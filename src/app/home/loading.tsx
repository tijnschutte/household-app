import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header shell - matches the flat brand header */}
      <header className="relative flex h-14 w-full shrink-0 items-center justify-center bg-primary px-4">
        <Skeleton className="h-5 w-40 bg-white/20" />
      </header>

      {/* Main scrollable content area */}
      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 pt-4 pb-6">
        <div className="w-full space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </main>

      {/* Footer shell - matches the add bar + segmented control stack */}
      <footer className="w-full shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
        <div className="mx-auto mt-2 w-full max-w-2xl">
          <Skeleton className="h-[52px] w-full rounded-lg" />
        </div>
      </footer>
    </div>
  );
}
