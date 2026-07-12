"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import { Button } from "@/src/components/ui/button";
import MonthNav from "@/src/components/geld/month-nav";
import BalanceCard from "@/src/components/geld/balance-card";
import ItemSection from "@/src/components/geld/item-section";
import AdjustmentsSection from "@/src/components/geld/adjustments-section";
import BeheerSheet from "@/src/components/geld/beheer-sheet";
import EmptyState from "@/src/components/geld/empty-state";
import type { GeldMonth, RecurringItemRow } from "@/src/lib/geld/data";

export default function GeldPageClient({
  month,
  data,
  recurringItems,
}: {
  month: string;
  data: GeldMonth;
  recurringItems: RecurringItemRow[];
}) {
  const [beheerOpen, setBeheerOpen] = useState(false);
  const [beheerAutoAdd, setBeheerAutoAdd] = useState(false);

  const openBeheer = (autoAdd: boolean) => {
    setBeheerAutoAdd(autoAdd);
    setBeheerOpen(true);
  };

  const hasItems = recurringItems.length > 0;

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Geld"
        left={<HuisButton />}
        right={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vaste posten beheren"
            className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
            onClick={() => openBeheer(false)}
          >
            <Settings className="h-5 w-5" />
          </Button>
        }
      />
      <main className="flex w-full max-w-2xl mx-auto flex-1 flex-col overflow-y-auto px-4 pt-4 pb-8">
        {!hasItems ? (
          <EmptyState onAdd={() => openBeheer(true)} />
        ) : (
          <div className="space-y-6">
            <MonthNav month={month} />
            <BalanceCard data={data} />
            <ItemSection title="Inkomsten" items={data.contributions} month={month} />
            <ItemSection title="Uitgaven" items={data.expenses} month={month} />
            <AdjustmentsSection month={month} adjustments={data.adjustments} />
          </div>
        )}
      </main>

      <BeheerSheet
        open={beheerOpen}
        onOpenChange={setBeheerOpen}
        items={recurringItems}
        autoOpenAdd={beheerAutoAdd}
      />
    </div>
  );
}
