"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
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
import { markPaid, undoPaid } from "@/src/lib/geld/actions";
import type { GeldItem } from "@/src/lib/geld/data";

function MarkPaidDialog({
  item,
  month,
  open,
  onOpenChange,
}: {
  item: GeldItem;
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => centsToInputValue(item.expectedCents));
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    const cents = parseEuroToCents(value);
    if (cents === null || cents <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    setIsSaving(true);
    try {
      await markPaid(item.id, month, cents);
      toast.success(`${item.name} gemarkeerd als betaald`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Markeren als betaald mislukt");
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

function ItemRow({ item, month }: { item: GeldItem; month: string }) {
  const router = useRouter();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await undoPaid(item.id, month);
      toast.success(`${item.name} weer op onbetaald gezet`);
      setUndoOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ongedaan maken mislukt");
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="min-w-0 truncate text-sm font-medium first-letter:uppercase">
        {item.name}
      </span>
      {item.entry ? (
        <button
          type="button"
          onClick={() => setUndoOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm hover:bg-accent"
        >
          <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
          <span className="tabular-nums">{formatEuro(item.entry.amountCents)}</span>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatEuro(item.expectedCents)}
          </span>
          <Button size="sm" variant="outline" onClick={() => setMarkPaidOpen(true)}>
            Betaald
          </Button>
        </div>
      )}

      <MarkPaidDialog
        item={item}
        month={month}
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
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
}: {
  title: string;
  items: GeldItem[];
  month: string;
}) {
  return (
    <div>
      <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">Geen items</p>
      ) : (
        <div className="divide-y divide-border px-1">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}
