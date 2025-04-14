"use server";

import { getHouseholdById } from "@/src/lib/data";
import { redirect } from "next/navigation";
import HouseholdClientPage from "./client-page";
import { auth, signOut } from "@/src/lib/auth";


export default async function Page() {
    const session = await auth();
    console.log("session:", session);
    if (!session?.user?.id) {
        redirect("/sign-in");
    }
    const householdId = await getHouseholdById(Number(session.user?.id));
    console.log("householdId:", householdId);
    if (!householdId) {
        redirect("/");
    }

    return <HouseholdClientPage 
                household={householdId} 
                userId={Number(session.user?.id)} 
            />;
}

