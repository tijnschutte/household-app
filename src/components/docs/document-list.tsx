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
import DocumentRow from "@/src/components/docs/document-row";
import { deleteDocCategory, renameDocCategory } from "@/src/lib/docs/actions";
import { UNCATEGORIZED_LABEL } from "@/src/lib/docs/constants";
import type { DocCategoryRow, DocRow } from "@/src/lib/docs/data";

function RenameCategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  category: DocCategoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Voer een naam in");
      return;
    }
    setIsSaving(true);
    try {
      await renameDocCategory(category.id, trimmed);
      toast.success("Categorie hernoemd");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hernoemen categorie mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        if (next) setName(category.name);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorie hernoemen</DialogTitle>
          <DialogDescription>Pas de naam van deze categorie aan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="doc-category-name">Naam</Label>
          <Input
            id="doc-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            disabled={isSaving}
            autoFocus
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

// Category heading with quiet rename/delete affordances, in the same visual
// register as the geld section headings.
function CategoryHeading({ category }: { category: DocCategoryRow }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDocCategory(category.id);
      toast.success(`Categorie "${category.name}" verwijderd`);
      setConfirmDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen categorie mislukt");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-1 pb-1.5">
      <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {category.name}
      </h3>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label={`Categorie ${category.name} hernoemen`}
          onClick={() => setRenameOpen(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          aria-label={`Categorie ${category.name} verwijderen`}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <RenameCategoryDialog category={category} open={renameOpen} onOpenChange={setRenameOpen} />

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !isDeleting && setConfirmDeleteOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Categorie {category.name} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              De documenten in deze categorie worden niet verwijderd — ze verhuizen naar &quot;
              {UNCATEGORIZED_LABEL}&quot;.
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

function DocumentRows({
  documents,
  categories,
}: {
  documents: DocRow[];
  categories: DocCategoryRow[];
}) {
  if (documents.length === 0) {
    return <p className="px-1 py-2 text-sm text-muted-foreground">Geen documenten</p>;
  }
  return (
    <div className="divide-y divide-border px-1">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} categories={categories} />
      ))}
    </div>
  );
}

/**
 * Groups the (already newest-first) documents under their category headings.
 * Categories come alphabetically sorted from the server; uncategorized comes
 * last under "Overig", whose heading only shows when it has documents or is
 * the only group.
 */
export default function DocumentList({
  documents,
  categories,
}: {
  documents: DocRow[];
  categories: DocCategoryRow[];
}) {
  const uncategorized = documents.filter((doc) => doc.categoryId === null);
  const showUncategorized = uncategorized.length > 0 || categories.length === 0;

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.id}>
          <CategoryHeading category={category} />
          <DocumentRows
            documents={documents.filter((doc) => doc.categoryId === category.id)}
            categories={categories}
          />
        </div>
      ))}
      {showUncategorized && (
        <div>
          <h3 className="px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {UNCATEGORIZED_LABEL}
          </h3>
          <DocumentRows documents={uncategorized} categories={categories} />
        </div>
      )}
    </div>
  );
}
