"use client";

import { useState } from "react";
import { Check, Loader2, ShoppingBasket } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { formatQuantity } from "@/src/lib/quantity";
import { mergeOutcome, type ListRow, type MergeOutcome } from "@/src/lib/recepten/basket";
import type { RecipeIngredientView } from "@/src/lib/recepten/view";

/**
 * What the list will do with this line, in words — the same decision the
 * write makes (recepten/basket.ts), shown before it is made. A line that is
 * simply new says nothing.
 */
function describe(outcome: MergeOutcome): string | null {
  switch (outcome.kind) {
    case "create":
      return null;
    case "sum": {
      const total = formatQuantity(outcome.quantity, outcome.row.unit);
      return total ? `staat al op de lijst · wordt ${total}` : "staat al op de lijst";
    }
    case "restore":
      return "al gekocht · komt opnieuw op de lijst";
    case "skip": {
      const existing = formatQuantity(outcome.row.quantity, outcome.row.unit);
      return `staat al op de lijst als ${existing} · wordt niet opgeteld`;
    }
  }
}

/**
 * The tick-off before "In mandje": every ingredient starts checked, and the
 * person unticks what is already in the house. Tells per line what the merge
 * will do, so a doubled quantity or a skipped unit is never a surprise on the
 * list.
 */
export default function BasketSheet({
  open,
  onOpenChange,
  ingredients,
  listRows,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredients: RecipeIngredientView[];
  listRows: ListRow[];
  /** True once the chosen names are on the list; false when they are not, already reported. */
  onConfirm: (names: string[]) => Promise<boolean>;
}) {
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  const chosen = ingredients.filter((line) => !unticked.has(line.name));

  const toggle = (name: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const confirm = async () => {
    setPending(true);
    try {
      const added = await onConfirm(chosen.map((line) => line.name));
      if (added) {
        onOpenChange(false);
        setUnticked(new Set());
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl px-4 pb-8"
      >
        <SheetHeader className="pb-3 text-left">
          <SheetTitle>In mandje</SheetTitle>
          <SheetDescription>
            Vink af wat je al in huis hebt. Alles gaat op de huishoudlijst.
          </SheetDescription>
        </SheetHeader>
        <ul className="divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {ingredients.map((line) => {
            const on = !unticked.has(line.name);
            const note = describe(mergeOutcome(line, listRows));
            return (
              <li key={line.name}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(line.name)}
                  disabled={pending}
                  className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                      on ? "border-primary bg-primary" : "border-gray-300"
                    }`}
                  >
                    {on && (
                      <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[15px] first-letter:uppercase ${on ? "" : "text-muted-foreground"}`}
                    >
                      {line.name}
                    </span>
                    {note && (
                      <span className="block truncate text-xs text-muted-foreground">{note}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatQuantity(line.quantity, line.unit)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          onClick={confirm}
          disabled={pending || chosen.length === 0}
          className="mt-3.5 h-12 w-full gap-2 text-[15px]"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" data-icon="inline-start" />
          ) : (
            <ShoppingBasket className="h-5 w-5" data-icon="inline-start" />
          )}
          {chosen.length === 1 ? "1 item toevoegen" : `${chosen.length} items toevoegen`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
