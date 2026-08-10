import { requireMembership } from "@/src/lib/membership/gate";
import { getGeldMonth, getRecurringItems } from "@/src/lib/geld/data";
import { currentMonth, isValidMonth } from "@/src/lib/geld/money";
import {
  addAdjustment,
  createRecurringItem,
  deleteAdjustment,
  deleteRecurringItem,
  endRecurringItem,
  markPaid,
  undoPaid,
  updateRecurringItem,
} from "@/src/lib/geld/actions";
import GeldPageClient, { type GeldActions } from "@/src/components/geld/geld-page-client";

// The composition root for the Geld page: the only place that knows which
// server action backs each operation the UI offers.
const geldActions: GeldActions = {
  onMarkPaid: markPaid,
  onUndoPaid: undoPaid,
  onAddAdjustment: addAdjustment,
  onDeleteAdjustment: deleteAdjustment,
  onCreateItem: createRecurringItem,
  onUpdateItem: updateRecurringItem,
  onEndItem: endRecurringItem,
  onDeleteItem: deleteRecurringItem,
};

export default async function GeldPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string }>;
}) {
  await requireMembership();

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
