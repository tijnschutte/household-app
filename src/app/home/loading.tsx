import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header shell - matches the flat brand header */}
      <header className="relative flex h-14 w-full shrink-0 items-center justify-center bg-primary px-4">
        <Skeleton className="h-5 w-40 bg-white/20" />
      </header>

      {/* Sub-header shell - matches the segmented control bar */}
      <div className="w-full shrink-0 border-b border-border bg-background px-4 py-2">
        <div className="w-full max-w-2xl mx-auto">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>

      {/* Main scrollable content area */}
      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 pt-4 pb-6">
        <div className="mb-4 flex justify-end">
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="w-full space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </main>
    </div>
  );
}
