"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
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
import { deleteKeyInfo, upsertKeyInfo } from "@/src/lib/docs/actions";
import type { KeyInfoRow } from "@/src/lib/docs/data";

// Add (label + value, both editable) and edit (value only — the label is the
// upsert key, see upsertKeyInfo) share one dialog.
function KeyInfoFormDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: KeyInfoRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = editing !== null;
  const [label, setLabel] = useState(editing?.label ?? "");
  const [value, setValue] = useState(editing?.value ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const resetFor = (item: KeyInfoRow | null) => {
    setLabel(item?.label ?? "");
    setValue(item?.value ?? "");
  };

  const handleConfirm = async () => {
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();
    if (!trimmedLabel) {
      toast.error("Voer een label in");
      return;
    }
    if (!trimmedValue) {
      toast.error("Voer een waarde in");
      return;
    }
    setIsSaving(true);
    try {
      await upsertKeyInfo(trimmedLabel, trimmedValue);
      toast.success(isEdit ? "Info bijgewerkt" : "Info toegevoegd");
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
        if (next) resetFor(editing);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Info bewerken" : "Info toevoegen"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Pas de waarde aan."
              : "Voeg belangrijke info toe, zoals het wifi-wachtwoord."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="keyinfo-label">Label</Label>
            <Input
              id="keyinfo-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="bijv. WiFi wachtwoord"
              maxLength={40}
              disabled={isSaving || isEdit}
              autoFocus={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyinfo-value">Waarde</Label>
            <Input
              id="keyinfo-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="bijv. huis1234"
              maxLength={200}
              disabled={isSaving}
              autoFocus={isEdit}
            />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? "Bezig..." : isEdit ? "Opslaan" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeyInfoRowView({ item, onEdit }: { item: KeyInfoRow; onEdit: () => void }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const copyValue = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.value);
      } else {
        // navigator.clipboard only exists in secure contexts; fall back for
        // e.g. http over LAN, same as household-info.tsx.
        const el = document.createElement("textarea");
        el.value = item.value;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (!ok) throw new Error("execCommand copy failed");
      }
      setCopied(true);
      toast.success("Gekopieerd");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying value:", error);
      toast.error("Kopiëren mislukt");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteKeyInfo(item.id);
      toast.success(`${item.label} verwijderd`);
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen mislukt");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium">{item.label}</p>
        <p className="truncate text-sm text-muted-foreground">{item.value}</p>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`${item.label} kopiëren`}
          onClick={copyValue}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`${item.label} verwijderen`}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !isDeleting && setConfirmDeleteOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{item.label} verwijderen?</AlertDialogTitle>
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

export default function KeyInfoCard({ keyInfo }: { keyInfo: KeyInfoRow[] }) {
  const [formItem, setFormItem] = useState<KeyInfoRow | null | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Belangrijke info</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {keyInfo.length === 0 ? (
          <p className="px-1 pb-2 text-sm text-muted-foreground">
            Nog geen info toegevoegd, zoals het wifi-wachtwoord.
          </p>
        ) : (
          <div className="divide-y divide-border px-1">
            {keyInfo.map((item) => (
              <KeyInfoRowView key={item.id} item={item} onEdit={() => setFormItem(item)} />
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => setFormItem(null)}
          className="mt-2 h-11 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Info toevoegen
        </Button>
      </CardContent>

      <KeyInfoFormDialog
        editing={formItem ?? null}
        open={formItem !== undefined}
        onOpenChange={(next) => !next && setFormItem(undefined)}
      />
    </Card>
  );
}
