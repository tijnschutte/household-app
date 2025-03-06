import { getHouseholdById } from "@/app/lib/data";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import HouseholdClientPage from "./client-page";


export default async function Page() {
    const session = await auth();
    if (!session?.user?.name) {
        redirect("/sign-in");
    }

    const household = await getHouseholdById(session.user.name);
    if (!household) {
        redirect("/household/create");
    }

    return <HouseholdClientPage household={household} />;
}

