"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { formatMonthLabel, shiftMonth } from "@/src/lib/geld/money";
import { ChevronLeft, ChevronRight } from "lucide-react";

// No artificial range limits — the ‹ › chevrons always work, all the way
// back to before the household started using Mandje and as far ahead as
// someone wants to plan.
export default function MonthNav({ month }: { month: string }) {
  const router = useRouter();

  const goTo = (target: string) => {
    router.push(`/geld?maand=${target}`);
  };

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Vorige maand"
        onClick={() => goTo(shiftMonth(month, -1))}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-base font-semibold">{formatMonthLabel(month)}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Volgende maand"
        onClick={() => goTo(shiftMonth(month, 1))}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
