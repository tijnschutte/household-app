"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { createDocCategory } from "@/src/lib/docs/actions";
import type { DocCategoryRow } from "@/src/lib/docs/data";

// Radix Select items can't have an empty-string value, so sentinels stand in
// for "uncategorized" and the inline "create new" affordance.
const NONE_VALUE = "none";
const NEW_VALUE = "__new__";

/**
 * Category picker for documents: household categories + "Geen categorie" +
 * an inline "Nieuwe categorie…" option (mirrors the grocery add-category
 * affordance) that creates one and auto-selects it.
 */
export default function CategorySelect({
  id,
  categories,
  value,
  onChange,
  disabled = false,
}: {
  id?: string;
  categories: DocCategoryRow[];
  value: number | null;
  onChange: (categoryId: number | null) => void;
  /** New categories created inline appear after router.refresh(); until then
   * the selected one is rendered from local state (see label fallback). */
  disabled?: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Freshly created category, possibly not yet in `categories` until the
  // server data refreshes.
  const [created, setCreated] = useState<DocCategoryRow | null>(null);

  const options =
    created && !categories.some((c) => c.id === created.id)
      ? [...categories, created].sort((a, b) => a.name.localeCompare(b.name, "nl"))
      : categories;

  const handleSelect = (next: string) => {
    if (next === NEW_VALUE) {
      setNewName("");
      setCreateOpen(true);
      return;
    }
    onChange(next === NONE_VALUE ? null : Number(next));
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Voer een categorienaam in");
      return;
    }
    setIsCreating(true);
    try {
      const category = await createDocCategory(trimmed);
      toast.success(`Categorie "${category.name}" aangemaakt`);
      setCreated(category);
      onChange(category.id);
      setCreateOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aanmaken categorie mislukt");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Select
        value={value === null ? NONE_VALUE : String(value)}
        onValueChange={handleSelect}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Geen categorie</SelectItem>
          {options.map((category) => (
            <SelectItem key={category.id} value={String(category.id)}>
              {category.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NEW_VALUE}>Nieuwe categorie…</SelectItem>
        </SelectContent>
      </Select>

      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          if (!isCreating) setCreateOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorie aanmaken</DialogTitle>
            <DialogDescription>
              Voeg een nieuwe categorie toe om documenten te organiseren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-doc-category">Categorienaam</Label>
            <Input
              id="new-doc-category"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="bijv. Contracten"
              maxLength={30}
              disabled={isCreating}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
              Annuleren
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Bezig..." : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
