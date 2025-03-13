import { getHouseholdById } from "@/app/lib/data";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HouseholdClientPage from "./client-page";


export default async function Page() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }
    const userId = parseInt(session.user.id);
    
    const household = await getHouseholdById(userId);
    if (!household) {
        redirect("/household/create");
    }

    return <HouseholdClientPage household={household} userId={userId} />;
}

