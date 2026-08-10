"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { centsToInputValue, formatEuro, parseEuroToCents } from "@/src/lib/geld/money";
import type { GeldItem } from "@/src/lib/geld/data";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * The two operations this section needs, owned here rather than imported from
 * the action module: the server page passes the real server actions in, and a
 * test passes a fake. Keeps Prisma out of anything that renders this.
 */
export type ItemSectionActions = {
  onMarkPaid: (
    recurringItemId: number,
    month: string,
    amountCents: number
  ) => Promise<ActionResult>;
  onUndoPaid: (recurringItemId: number, month: string) => Promise<ActionResult>;
};

function MarkPaidDialog({
  item,
  month,
  open,
  onOpenChange,
  onMarkPaid,
}: {
  item: GeldItem;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<ItemSectionActions, "onMarkPaid">) {
  const router = useRouter();
  const [value, setValue] = useState(() => centsToInputValue(item.expectedCents));
  const [isSaving, setIsSaving] = useState(false);

  // The dialog stays mounted and `open` changes programmatically (no Radix
  // onOpenChange), so re-seed the amount on every open.
  useEffect(() => {
    if (open) setValue(centsToInputValue(item.expectedCents));
  }, [open, item.expectedCents]);

  const handleConfirm = async () => {
    const cents = parseEuroToCents(value);
    if (cents === null || cents <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    setIsSaving(true);
    try {
      const result = await onMarkPaid(item.id, month, cents);

      // "Al betaald" arrives as a value; thrown, its message would be redacted
      // in production and the dialog would close on a write that never landed.
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${item.name} gemarkeerd als betaald`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to mark paid:", error);
      toast.error("Markeren als betaald mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name} betaald</DialogTitle>
          <DialogDescription>Voer het betaalde bedrag in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="paid-amount">Bedrag</Label>
          <Input
            id="paid-amount"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSaving}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : "Bevestigen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  item,
  month,
  onMarkPaid,
  onUndoPaid,
}: { item: GeldItem; month: string } & ItemSectionActions) {
  const router = useRouter();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      const result = await onUndoPaid(item.id, month);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${item.name} weer op onbetaald gezet`);
      setUndoOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to undo paid:", error);
      toast.error("Ongedaan maken mislukt");
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div>
      {/* One "done" gesture across the app: the same circle checkbox as the
          grocery list. Tapping anywhere on the row marks paid (via the amount
          dialog) or, when already paid, opens the undo dialog. */}
      <button
        type="button"
        onClick={() => (item.entry ? setUndoOpen(true) : setMarkPaidOpen(true))}
        aria-label={
          item.entry ? `${item.name}: betaling ongedaan maken` : `${item.name}: markeer als betaald`
        }
        className="flex min-h-12 w-full items-center gap-3 py-1.5 text-left"
      >
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            item.entry ? "border-primary bg-primary" : "border-gray-300"
          }`}
        >
          {item.entry && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
          {item.name}
        </span>
        <span
          className={`shrink-0 text-sm tabular-nums ${item.entry ? "" : "text-muted-foreground"}`}
        >
          {formatEuro(item.entry ? item.entry.amountCents : item.expectedCents)}
        </span>
      </button>

      <MarkPaidDialog
        item={item}
        month={month}
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        onMarkPaid={onMarkPaid}
      />

      <AlertDialog open={undoOpen} onOpenChange={(next) => !isUndoing && setUndoOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Betaald: {item.entry ? formatEuro(item.entry.amountCents) : ""}. Ongedaan maken
              verwijdert deze betaling voor deze maand.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Sluiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndo}
              disabled={isUndoing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUndoing ? "Bezig..." : "Ongedaan maken"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ItemSection({
  title,
  items,
  month,
  onAdd,
  addLabel,
  onMarkPaid,
  onUndoPaid,
}: {
  title: string;
  items: GeldItem[];
  month: string;
  onAdd: () => void;
  addLabel: string;
} & ItemSectionActions) {
  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="-my-3 -mr-2 h-10 w-10 text-muted-foreground hover:text-foreground"
          aria-label={addLabel}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">Geen items</p>
      ) : (
        <div className="divide-y divide-border px-1">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              month={month}
              onMarkPaid={onMarkPaid}
              onUndoPaid={onUndoPaid}
            />
          ))}
        </div>
      )}
    </div>
  );
}
