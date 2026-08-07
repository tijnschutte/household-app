import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { getHouseholdById } from "@/src/lib/data";
import { getGeldMonth, getRecurringItems } from "@/src/lib/geld/data";
import { currentMonth, isValidMonth } from "@/src/lib/geld/money";
import { addAdjustment, deleteAdjustment, markPaid, undoPaid } from "@/src/lib/geld/actions";
import GeldPageClient, { type GeldActions } from "@/src/components/geld/geld-page-client";

// The composition root for the Geld page: the only place that knows which
// server action backs each operation the UI offers.
const geldActions: GeldActions = {
  onMarkPaid: markPaid,
  onUndoPaid: undoPaid,
  onAddAdjustment: addAdjustment,
  onDeleteAdjustment: deleteAdjustment,
};

export default async function GeldPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const household = await getHouseholdById(Number(session.user.id));

  if (!household) {
    redirect("/household-setup");
  }

  const { maand } = await searchParams;
  const month = maand && isValidMonth(maand) ? maand : currentMonth();

  const [geldMonth, recurringItems] = await Promise.all([getGeldMonth(month), getRecurringItems()]);

  return (
    <GeldPageClient
      month={month}
      data={geldMonth}
      recurringItems={recurringItems}
      actions={geldActions}
    />
  );
}
