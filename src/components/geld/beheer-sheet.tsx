"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";
import { RECURRING_KIND, type RecurringKind } from "@/src/lib/geld/recurring-kind";
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
import type { RecurringItemRow } from "@/src/lib/geld/data";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * The four operations this sheet needs, owned here rather than imported from
 * the action module: the server page passes the real server actions in, and a
 * test passes a fake. Keeps Prisma out of anything that renders this.
 */
export type BeheerSheetActions = {
  // `unknown` on purpose: creating returns the new post, and this sheet closes
  // and refreshes rather than reading it.
  onCreateItem: (
    name: string,
    kind: RecurringKind,
    expectedCents: number,
    activeFrom: string
  ) => Promise<ActionResult<unknown>>;
  onUpdateItem: (
    id: number,
    updates: { name?: string; expectedCents?: number }
  ) => Promise<ActionResult>;
  onEndItem: (id: number, lastMonth: string) => Promise<ActionResult>;
  onDeleteItem: (id: number) => Promise<ActionResult>;
};

const KIND_LABEL: Record<RecurringKind, string> = {
  CONTRIBUTION: "Inleg",
  EXPENSE: "Uitgave",
};

/**
 * What both dialogs need before they can save. Returns the reason instead of
 * toasting, so the caller decides how to say it — same shape as parseItemName.
 */
type ItemDraft = { ok: true; name: string; cents: number } | { ok: false; message: string };

function parseItemDraft(name: string, amount: string): ItemDraft {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, message: "Voer een naam in" };
  }
  const cents = parseEuroToCents(amount);
  if (cents === null || cents <= 0) {
    return { ok: false, message: "Voer een geldig bedrag in" };
  }
  return { ok: true, name: trimmed, cents };
}

/** The two fields both dialogs ask for, and the only two that editing changes. */
function NameAndAmountFields({
  name,
  onNameChange,
  amount,
  onAmountChange,
  disabled,
}: {
  name: string;
  onNameChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="item-name">Naam</Label>
        <Input
          id="item-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="bijv. Ziggo"
          maxLength={40}
          disabled={disabled}
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
          onChange={(e) => onAmountChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

function AddItemDialog({
  defaultKind,
  open,
  onOpenChange,
  onCreateItem,
}: {
  defaultKind: RecurringKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<BeheerSheetActions, "onCreateItem">) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RecurringKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [activeFrom, setActiveFrom] = useState(currentMonth());
  const [isSaving, setIsSaving] = useState(false);

  // The dialog stays mounted and is opened by a controlled prop, which does not
  // fire Radix's onOpenChange — so a fresh form has to be an effect on `open`.
  useEffect(() => {
    if (!open) return;
    setName("");
    setKind(defaultKind);
    setAmount("");
    setActiveFrom(currentMonth());
  }, [open, defaultKind]);

  const handleConfirm = async () => {
    const draft = parseItemDraft(name, amount);
    if (!draft.ok) {
      toast.error(draft.message);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onCreateItem(draft.name, kind, draft.cents, activeFrom);

      // "Bestaat al" needs the form left open with the name still in it, so a
      // rejection must not take the same path as a save.
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Post aangemaakt");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to create recurring item:", error);
      toast.error("Opslaan mislukt");
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
          <DialogTitle>Nieuwe post</DialogTitle>
          <DialogDescription>Voeg een nieuwe vaste inleg of uitgave toe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
          <NameAndAmountFields
            name={name}
            onNameChange={setName}
            amount={amount}
            onAmountChange={setAmount}
            disabled={isSaving}
          />
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
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : "Aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Editing deliberately offers less than adding: `kind` and `activeFrom` are
 * what the item's history was recorded against, so changing them after the
 * fact would rewrite months already settled. Ending an item is the way out.
 */
function EditItemDialog({
  item,
  open,
  onOpenChange,
  onUpdateItem,
}: {
  item: RecurringItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<BeheerSheetActions, "onUpdateItem">) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Same programmatic-open caveat as the add dialog, plus this one is reused
  // for a different item each time it opens.
  useEffect(() => {
    if (!open || !item) return;
    setName(item.name);
    setAmount(centsToInputValue(item.expectedCents));
  }, [open, item]);

  const handleConfirm = async () => {
    if (!item) return;
    const draft = parseItemDraft(name, amount);
    if (!draft.ok) {
      toast.error(draft.message);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onUpdateItem(item.id, { name: draft.name, expectedCents: draft.cents });
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Post bijgewerkt");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to update recurring item:", error);
      toast.error("Opslaan mislukt");
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
          <DialogTitle>Post bewerken</DialogTitle>
          <DialogDescription>Pas de naam of het verwachte bedrag aan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <NameAndAmountFields
            name={name}
            onNameChange={setName}
            amount={amount}
            onAmountChange={setAmount}
            disabled={isSaving}
          />
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : "Opslaan"}
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
  onEndItem,
}: {
  item: RecurringItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Pick<BeheerSheetActions, "onEndItem">) {
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
      const result = await onEndItem(item.id, lastMonth);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${item.name} beëindigd`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to end recurring item:", error);
      toast.error("Beëindigen mislukt");
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
  onDeleteItem,
}: {
  item: RecurringItemRow;
  onEdit: () => void;
  onEnd: () => void;
} & Pick<BeheerSheetActions, "onDeleteItem">) {
  const router = useRouter();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const ended = item.activeTo !== null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await onDeleteItem(item.id);

      // "Item is al gebruikt — beëindig het" is the whole point of this
      // confirm: the user needs to read it and reach for Beëindigen instead.
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${item.name} verwijderd`);
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete recurring item:", error);
      toast.error("Verwijderen mislukt");
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
  autoAddKind = null,
  onCreateItem,
  onUpdateItem,
  onEndItem,
  onDeleteItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RecurringItemRow[];
  /** When set, opens the "add" dialog with this kind preselected as soon as
      the sheet opens (section-header "+" and empty-state CTA). */
  autoAddKind?: RecurringKind | null;
} & BeheerSheetActions) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringItemRow | null>(null);
  const [endItem, setEndItem] = useState<RecurringItemRow | null>(null);

  // The sheet opens programmatically (controlled `open`), so the auto-opened
  // add dialog can't hang off onOpenChange.
  useEffect(() => {
    if (open && autoAddKind) setAddOpen(true);
  }, [open, autoAddKind]);

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
                  onEdit={() => setEditItem(item)}
                  onEnd={() => setEndItem(item)}
                  onDeleteItem={onDeleteItem}
                />
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            onClick={() => setAddOpen(true)}
            className="mt-2 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Post toevoegen
          </Button>
        </div>
      </SheetContent>

      <AddItemDialog
        defaultKind={autoAddKind ?? RECURRING_KIND.CONTRIBUTION}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreateItem={onCreateItem}
      />
      <EditItemDialog
        item={editItem}
        open={editItem !== null}
        onOpenChange={(next) => !next && setEditItem(null)}
        onUpdateItem={onUpdateItem}
      />
      <EndItemDialog
        item={endItem}
        open={endItem !== null}
        onOpenChange={(next) => !next && setEndItem(null)}
        onEndItem={onEndItem}
      />
    </Sheet>
  );
}
