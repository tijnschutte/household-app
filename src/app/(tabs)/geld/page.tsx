import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import PageHeader from "@/src/components/page-header";
import { Wallet } from "lucide-react";

export default async function GeldPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (!household) {
    redirect("/household-setup");
  }

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Geld" />
      <main className="flex w-full max-w-2xl mx-auto flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Wallet className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Binnenkort</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Hier komt het maandoverzicht van {household.name}: vaste lasten, inleg en het saldo op de
          gezamenlijke rekening.
        </p>
      </main>
    </div>
  );
}
