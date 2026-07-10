"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import CategorySelect from "@/src/components/docs/category-select";
import { deleteDocument, updateDocument } from "@/src/lib/docs/actions";
import { formatDocDate, formatFileSize } from "@/src/lib/docs/format";
import type { DocCategoryRow, DocRow } from "@/src/lib/docs/data";

function EditDialog({
  doc,
  categories,
  open,
  onOpenChange,
}: {
  doc: DocRow;
  categories: DocCategoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(doc.name);
  const [categoryId, setCategoryId] = useState<number | null>(doc.categoryId);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Voer een naam in");
      return;
    }
    setIsSaving(true);
    try {
      await updateDocument(doc.id, trimmed, categoryId);
      toast.success("Document bijgewerkt");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bijwerken mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        if (next) {
          setName(doc.name);
          setCategoryId(doc.categoryId);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document bewerken</DialogTitle>
          <DialogDescription>Pas de naam of categorie aan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-name">Naam</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-edit-category">Categorie</Label>
            <CategorySelect
              id="doc-edit-category"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              disabled={isSaving}
            />
          </div>
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

export default function DocumentRow({
  doc,
  categories,
}: {
  doc: DocRow;
  categories: DocCategoryRow[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDocument(doc.id);
      toast.success(`${doc.name} verwijderd`);
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
      <a
        href={`/api/docs/${doc.id}/download`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 rounded-md py-0.5 hover:opacity-80"
      >
        <p className="truncate text-sm font-medium">{doc.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.uploadedByName ?? "Onbekend"} · {formatDocDate(doc.createdAt)} ·{" "}
          {formatFileSize(doc.sizeBytes)}
        </p>
      </a>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`${doc.name} bewerken`}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`${doc.name} verwijderen`}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <EditDialog doc={doc} categories={categories} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !isDeleting && setConfirmDeleteOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{doc.name} verwijderen?</AlertDialogTitle>
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
