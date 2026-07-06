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
    const household = await getHouseholdById(Number(session.user?.id));
    if (!household) {
        redirect("/household-setup");
    }

    return <HouseholdClientPage household={household} />;
}

