"use server";

import { getHouseholdById } from "@/src/lib/data";
import { redirect } from "next/navigation";
import HouseholdClientPage from "./client-page";
import { auth, signOut } from "@/src/lib/auth";


export default async function Page() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/sign-in");
    }
    const userId = parseInt(session.user.id, 10);
    if (isNaN(userId)) {
        redirect("/sign-in");
    }
    const householdId = await getHouseholdById(userId);
    if (!householdId) {
        redirect("/");
    }

    return <HouseholdClientPage 
                household={householdId} 
                userId={userId} 
            />;
}

