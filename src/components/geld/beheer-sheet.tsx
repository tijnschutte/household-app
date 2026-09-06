"use client";

import { useState } from "react";
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
import type { RecurringItemRow } from "@/src/lib/geld/view";
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

/**
 * The three dialogs below are mounted only while they are the one open (see
 * BeheerSheetBody), so each starts from its props on mount and needs no reset.
 */
function AddItemDialog({
  defaultKind,
  onClose,
  onCreateItem,
}: {
  defaultKind: RecurringKind;
  onClose: () => void;
} & Pick<BeheerSheetActions, "onCreateItem">) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RecurringKind>(defaultKind);
  const [amount, setAmount] = useState("");
  const [activeFrom, setActiveFrom] = useState(currentMonth);
  const [isSaving, setIsSaving] = useState(false);

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
      onClose();
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
      open
      onOpenChange={(next) => {
        if (!next && !isSaving) onClose();
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
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
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
  onClose,
  onUpdateItem,
}: {
  item: RecurringItemRow;
  onClose: () => void;
} & Pick<BeheerSheetActions, "onUpdateItem">) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(() => centsToInputValue(item.expectedCents));
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
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
      onClose();
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
      open
      onOpenChange={(next) => {
        if (!next && !isSaving) onClose();
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
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
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
  onClose,
  onEndItem,
}: {
  item: RecurringItemRow;
  onClose: () => void;
} & Pick<BeheerSheetActions, "onEndItem">) {
  const router = useRouter();
  const [lastMonth, setLastMonth] = useState(currentMonth);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const result = await onEndItem(item.id, lastMonth);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`${item.name} beëindigd`);
      onClose();
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
      open
      onOpenChange={(next) => {
        if (!next && !isSaving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name} beëindigen</DialogTitle>
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
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
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

/** Which dialog sits on top of the list, and what it was opened for. They are
    modal, so at most one at a time. */
type OpenDialog =
  | { type: "add"; defaultKind: RecurringKind }
  | { type: "edit"; item: RecurringItemRow }
  | { type: "end"; item: RecurringItemRow };

type BeheerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RecurringItemRow[];
  /** When set, opens the "add" dialog with this kind preselected as soon as
      the sheet opens (section-header "+" and empty-state CTA). */
  autoAddKind?: RecurringKind | null;
} & BeheerSheetActions;

/**
 * Lives inside SheetContent, which Radix mounts only while the sheet is open:
 * every open starts from a clean slate, so `autoAddKind` can seed the initial
 * dialog directly instead of being mirrored into state by an effect.
 */
function BeheerSheetBody({
  items,
  autoAddKind,
  onCreateItem,
  onUpdateItem,
  onEndItem,
  onDeleteItem,
}: Omit<BeheerSheetProps, "open" | "onOpenChange">) {
  const [dialog, setDialog] = useState<OpenDialog | null>(() =>
    autoAddKind ? { type: "add", defaultKind: autoAddKind } : null
  );
  const closeDialog = () => setDialog(null);

  return (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nog geen posten toegevoegd.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <RecurringItemRowView
                key={item.id}
                item={item}
                onEdit={() => setDialog({ type: "edit", item })}
                onEnd={() => setDialog({ type: "end", item })}
                onDeleteItem={onDeleteItem}
              />
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() =>
            setDialog({
              type: "add",
              defaultKind: autoAddKind ?? RECURRING_KIND.CONTRIBUTION,
            })
          }
          className="mt-2 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Post toevoegen
        </Button>
      </div>

      {dialog?.type === "add" && (
        <AddItemDialog
          defaultKind={dialog.defaultKind}
          onClose={closeDialog}
          onCreateItem={onCreateItem}
        />
      )}
      {dialog?.type === "edit" && (
        <EditItemDialog item={dialog.item} onClose={closeDialog} onUpdateItem={onUpdateItem} />
      )}
      {dialog?.type === "end" && (
        <EndItemDialog item={dialog.item} onClose={closeDialog} onEndItem={onEndItem} />
      )}
    </>
  );
}

export default function BeheerSheet({ open, onOpenChange, ...body }: BeheerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[85vh] flex-col gap-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Vaste posten</SheetTitle>
          <SheetDescription>Beheer de inleg en uitgaven van het huishouden.</SheetDescription>
        </SheetHeader>
        <BeheerSheetBody {...body} />
      </SheetContent>
    </Sheet>
  );
}
