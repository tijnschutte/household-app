"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import { RecurringKind } from "@prisma/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
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
import {
  centsToInputValue,
  currentMonth,
  formatEuro,
  formatMonthLabel,
  parseEuroToCents,
} from "@/src/lib/geld/money";
import {
  createRecurringItem,
  deleteRecurringItem,
  endRecurringItem,
  updateRecurringItem,
} from "@/src/lib/geld/actions";
import type { RecurringItemRow } from "@/src/lib/geld/data";

const KIND_LABEL: Record<RecurringKind, string> = {
  CONTRIBUTION: "Inleg",
  EXPENSE: "Uitgave",
};

// Add (kind + from-month editable) and edit (name + amount only) share one
// dialog, distinguished by whether `editing` is set.
function ItemFormDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: RecurringItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = editing !== null;
  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<RecurringKind>(editing?.kind ?? RecurringKind.CONTRIBUTION);
  const [amount, setAmount] = useState(editing ? centsToInputValue(editing.expectedCents) : "");
  const [activeFrom, setActiveFrom] = useState(editing?.activeFrom ?? currentMonth());
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed local state whenever the dialog is (re)opened for a (possibly
  // different) item — the dialog stays mounted, so state wouldn't otherwise
  // reset. This must be an effect on the controlled `open` prop: it changes
  // programmatically, which does not fire Radix's onOpenChange.
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? RecurringKind.CONTRIBUTION);
    setAmount(editing ? centsToInputValue(editing.expectedCents) : "");
    setActiveFrom(editing?.activeFrom ?? currentMonth());
  }, [open, editing]);

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Voer een naam in");
      return;
    }
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Voer een geldig bedrag in");
      return;
    }

    setIsSaving(true);
    try {
      if (isEdit) {
        await updateRecurringItem(editing.id, { name: trimmedName, expectedCents: cents });
        toast.success("Post bijgewerkt");
      } else {
        await createRecurringItem(trimmedName, kind, cents, activeFrom);
        toast.success("Post aangemaakt");
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Post bewerken" : "Nieuwe post"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Pas de naam of het verwachte bedrag aan."
              : "Voeg een nieuwe vaste inleg of uitgave toe."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && (
            <div className="space-y-2">
              <Label>Soort</Label>
              <div className="inline-flex rounded-lg border border-border p-0.5">
                {(Object.keys(KIND_LABEL) as RecurringKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    disabled={isSaving}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                      kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="item-name">Naam</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="bijv. Ziggo"
              maxLength={40}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-amount">Verwacht bedrag</Label>
            <Input
              id="item-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSaving}
            />
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="item-active-from">Actief vanaf</Label>
              <Input
                id="item-active-from"
                type="month"
                value={activeFrom}
                onChange={(e) => setActiveFrom(e.target.value)}
                disabled={isSaving}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : isEdit ? "Opslaan" : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: RecurringItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [lastMonth, setLastMonth] = useState(currentMonth());
  const [isSaving, setIsSaving] = useState(false);

  // Same programmatic-open caveat as ItemFormDialog: re-seed via effect.
  useEffect(() => {
    if (open) setLastMonth(currentMonth());
  }, [open]);

  const handleConfirm = async () => {
    if (!item) return;
    setIsSaving(true);
    try {
      await endRecurringItem(item.id, lastMonth);
      toast.success(`${item.name} beëindigd`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Beëindigen mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.name} beëindigen</DialogTitle>
          <DialogDescription>
            Kies de laatste maand waarin deze post nog actief is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="last-month">Laatste maand</Label>
          <Input
            id="last-month"
            type="month"
            value={lastMonth}
            onChange={(e) => setLastMonth(e.target.value)}
            disabled={isSaving}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : "Beëindigen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecurringItemRowView({
  item,
  onEdit,
  onEnd,
}: {
  item: RecurringItemRow;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const router = useRouter();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const ended = item.activeTo !== null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRecurringItem(item.id);
      toast.success(`${item.name} verwijderd`);
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen mislukt");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 py-2.5 ${ended ? "opacity-50" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium first-letter:uppercase">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {KIND_LABEL[item.kind]} · {formatEuro(item.expectedCents)} ·{" "}
          {formatMonthLabel(item.activeFrom)}
          {" – "}
          {item.activeTo ? formatMonthLabel(item.activeTo) : "heden"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground"
          aria-label={`${item.name} bewerken`}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {!ended && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            aria-label={`${item.name} beëindigen`}
            onClick={onEnd}
          >
            <CalendarOff className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-destructive disabled:opacity-30"
          aria-label={`${item.name} verwijderen`}
          disabled={item.hasEntries}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !isDeleting && setConfirmDeleteOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.name} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
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

export default function BeheerSheet({
  open,
  onOpenChange,
  items,
  autoOpenAdd = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RecurringItemRow[];
  /** Opens the "add" dialog immediately once the sheet is open (empty state CTA). */
  autoOpenAdd?: boolean;
}) {
  const [formItem, setFormItem] = useState<RecurringItemRow | null | undefined>(undefined);
  const [endItem, setEndItem] = useState<RecurringItemRow | null>(null);

  const openAdd = () => setFormItem(null);

  // The sheet opens programmatically (controlled `open`), so the empty-state
  // CTA's auto-opened add dialog can't hang off onOpenChange.
  useEffect(() => {
    if (open && autoOpenAdd) setFormItem(null);
  }, [open, autoOpenAdd]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col gap-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Vaste posten</SheetTitle>
          <SheetDescription>Beheer de inleg en uitgaven van het huishouden.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nog geen posten toegevoegd.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <RecurringItemRowView
                  key={item.id}
                  item={item}
                  onEdit={() => setFormItem(item)}
                  onEnd={() => setEndItem(item)}
                />
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            onClick={openAdd}
            className="mt-2 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Post toevoegen
          </Button>
        </div>
      </SheetContent>

      <ItemFormDialog
        editing={formItem ?? null}
        open={formItem !== undefined}
        onOpenChange={(next) => !next && setFormItem(undefined)}
      />
      <EndItemDialog
        item={endItem}
        open={endItem !== null}
        onOpenChange={(next) => !next && setEndItem(null)}
      />
    </Sheet>
  );
}
