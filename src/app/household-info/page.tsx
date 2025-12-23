import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import HouseholdInfo from "@/src/components/household-info";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function HouseholdInfoPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (!household) {
    redirect("/household-setup");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/home">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar home
          </Link>
        </Button>
        <HouseholdInfo household={household} userId={Number(session.user.id)} />
      </div>
    </div>
  );
}
