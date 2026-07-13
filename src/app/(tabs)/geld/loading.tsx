import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header shell - matches the flat brand header */}
      <header className="relative flex h-14 w-full shrink-0 items-center justify-center bg-primary px-4">
        <Skeleton className="h-5 w-24 bg-white/20" />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-4 pb-8">
        <div className="space-y-6">
          {/* Month nav */}
          <Skeleton className="h-10 w-full rounded-lg" />
          {/* Balance card */}
          <Skeleton className="h-28 w-full rounded-xl" />
          {/* Inleg / Uitgaven sections */}
          {Array.from({ length: 2 }).map((_, section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              {Array.from({ length: 3 }).map((_, row) => (
                <Skeleton key={row} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
