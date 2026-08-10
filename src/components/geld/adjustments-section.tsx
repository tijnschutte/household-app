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
import type { GeldAdjustment } from "@/src/lib/geld/view";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * The two operations this section needs, owned here rather than imported from
 * the action module: the server page passes the real server actions in, and a
 * test passes a fake. Keeps Prisma out of anything that renders this.
 */
export type AdjustmentsSectionActions = {
  onAddAdjustment: (month: string, amountCents: number, note?: string) => Promise<ActionResult>;
  onDeleteAdjustment: (adjustmentId: number) => Promise<ActionResult>;
};

function AddAdjustmentDialog({
  month,
  open,
  onOpenChange,
  onAddAdjustment,
}: {
  month: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<AdjustmentsSectionActions, "onAddAdjustment">) {
  const router = useRouter();
  const [sign, setSign] = useState<1 | -1>(1);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // The single way out of this dialog. Cancelling, Escape, the overlay and a
  // successful save all land here, so reopening never shows the last attempt.
  const close = () => {
    setSign(1);
    setValue("");
    setNote("");
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    const cents = parseEuroToCents(value);
    if (cents === null || cents <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }
    setIsSaving(true);
    try {
      const result = await onAddAdjustment(month, cents * sign, note.trim() || undefined);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Correctie toegevoegd");
      close();
      router.refresh();
    } catch (error) {
      console.error("Failed to add adjustment:", error);
      toast.error("Toevoegen correctie mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        if (next) onOpenChange(true);
        else close();
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
          <Button variant="outline" onClick={close} disabled={isSaving}>
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

function AdjustmentRow({
  adjustment,
  onDeleteAdjustment,
}: { adjustment: GeldAdjustment } & Pick<AdjustmentsSectionActions, "onDeleteAdjustment">) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await onDeleteAdjustment(adjustment.id);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Correctie verwijderd");
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete adjustment:", error);
      toast.error("Verwijderen correctie mislukt");
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
          className="-my-2 h-11 w-11 text-muted-foreground hover:text-destructive"
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
  onAddAdjustment,
  onDeleteAdjustment,
}: {
  month: string;
  adjustments: GeldAdjustment[];
} & AdjustmentsSectionActions) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Correcties
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="-my-3 -mr-2 h-10 w-10 text-muted-foreground hover:text-foreground"
          aria-label="Correctie toevoegen"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {adjustments.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">Geen correcties</p>
      ) : (
        <div className="divide-y divide-border px-1">
          {adjustments.map((adjustment) => (
            <AdjustmentRow
              key={adjustment.id}
              adjustment={adjustment}
              onDeleteAdjustment={onDeleteAdjustment}
            />
          ))}
        </div>
      )}
      <AddAdjustmentDialog
        month={month}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAddAdjustment={onAddAdjustment}
      />
    </div>
  );
}
