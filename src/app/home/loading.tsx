import { Skeleton } from "@/src/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header shell */}
            <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 w-full py-6 shadow-lg">
                <div className="flex flex-row justify-center items-center relative px-4">
                    <Skeleton className="h-7 w-40 bg-white/20" />
                </div>
            </header>

            {/* Main scrollable content area */}
            <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-6 pt-6 pb-6">
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
