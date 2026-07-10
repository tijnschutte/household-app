"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { formatEuro, parseEuroToCents } from "@/src/lib/geld/money";
import { addAdjustment, deleteAdjustment } from "@/src/lib/geld/actions";
import type { GeldAdjustment } from "@/src/lib/geld/data";

function AddAdjustmentDialog({
  month,
  open,
  onOpenChange,
}: {
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [sign, setSign] = useState<1 | -1>(1);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setSign(1);
    setValue("");
    setNote("");
  };

  const handleConfirm = async () => {
    const cents = parseEuroToCents(value);
    if (cents === null || cents <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    setIsSaving(true);
    try {
      await addAdjustment(month, cents * sign, note.trim() || undefined);
      toast.success("Correctie toegevoegd");
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen correctie mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) {
          if (!next) reset();
          onOpenChange(next);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correctie toevoegen</DialogTitle>
          <DialogDescription>
            Trek de pot recht met een eenmalige plus of min voor deze maand.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Richting</Label>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setSign(1)}
                disabled={isSaving}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  sign === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                + Erbij
              </button>
              <button
                type="button"
                onClick={() => setSign(-1)}
                disabled={isSaving}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  sign === -1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                − Eraf
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustment-amount">Bedrag</Label>
            <Input
              id="adjustment-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjustment-note">Notitie (optioneel)</Label>
            <Input
              id="adjustment-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="bijv. te veel afgeschreven in juni"
              maxLength={100}
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentRow({ adjustment }: { adjustment: GeldAdjustment }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAdjustment(adjustment.id);
      toast.success("Correctie verwijderd");
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen correctie mislukt");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="min-w-0 truncate text-sm text-foreground">
        {adjustment.note || "Correctie"}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`text-sm tabular-nums ${
            adjustment.amountCents < 0 ? "text-destructive" : "text-foreground"
          }`}
        >
          {adjustment.amountCents > 0 ? "+" : ""}
          {formatEuro(adjustment.amountCents)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label="Correctie verwijderen"
          onClick={() => setConfirmOpen(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !isDeleting && setConfirmOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Correctie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {adjustment.note || "Deze correctie"} ({formatEuro(adjustment.amountCents)}) wordt
              verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Bezig..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdjustmentsSection({
  month,
  adjustments,
}: {
  month: string;
  adjustments: GeldAdjustment[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rechttrekken
      </h3>
      {adjustments.length > 0 && (
        <div className="divide-y divide-border px-1">
          {adjustments.map((adjustment) => (
            <AdjustmentRow key={adjustment.id} adjustment={adjustment} />
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        onClick={() => setAddOpen(true)}
        className="mt-2 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Correctie toevoegen
      </Button>
      <AddAdjustmentDialog month={month} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
