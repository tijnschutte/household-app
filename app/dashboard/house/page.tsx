"use client";
import { useRouter } from "next/navigation";

export default function Page() {
    const router = useRouter();

    return (
        <main className="flex flex-col h-screen justify-center items-center overflow-x-hidden w-full font-sarif space-y-2">
            <div className="bg-gray-400 rounded-3xl border min-w-[600px] min-h-[200px] p-6">
                <span>Tijn Schutte</span>
            </div>
            <button 
                onClick={() => {
                    router.push("/dashboard/house/groceries");
                }}
            >
                Groceries    
            </button>
        </main>
    )
}