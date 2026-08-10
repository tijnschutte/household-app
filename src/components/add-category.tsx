"use client";

import { useState } from "react";
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
import { Category } from "@prisma/client";
import type { ActionResult } from "@/src/lib/action-result";
import type { ViewKey } from "@/src/lib/house/grocery-view";
import { toast } from "sonner";

/**
 * The one operation this dialog needs, owned here rather than imported from
 * the action module: the server page passes the real server action in, and a
 * test passes a fake. Keeps Prisma out of anything that renders this.
 */
export type AddCategoryActions = {
  onCreateCategory: (name: string, view: ViewKey) => Promise<ActionResult<Category>>;
};

type AddCategoryProps = {
  view: ViewKey;
  onCategoryAdded: (category: Category) => void;
  // Controlled from the add-bar's category picker ("+ Nieuwe categorie").
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & AddCategoryActions;

export default function AddCategory({
  view,
  onCategoryAdded,
  open,
  onOpenChange,
  onCreateCategory,
}: AddCategoryProps) {
  const [categoryName, setCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const setIsOpen = (next: boolean) => {
    // The dialog stays mounted, so drop a cancelled attempt's text on close.
    if (!next) setCategoryName("");
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast.error("Voer een categorienaam in");
      return;
    }

    setIsCreating(true);
    try {
      const result = await onCreateCategory(categoryName, view);

      // An expected failure arrives as a result, not an exception, and its
      // message is the only one written for a human — the catch below cannot
      // see it, because in production nothing thrown carries a message at all.
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`Categorie "${categoryName}" aangemaakt`);
      setCategoryName("");
      setIsOpen(false);
      onCategoryAdded(result.value);
    } catch (error) {
      console.error("Failed to create category:", error);
      toast.error("Aanmaken categorie mislukt");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorie aanmaken</DialogTitle>
          <DialogDescription>
            Voeg een nieuwe categorie toe om je boodschappen te organiseren
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Categorienaam</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="bijv. Jumbo, Etos, etc."
                disabled={isCreating}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isCreating}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Aanmaken..." : "Categorie aanmaken"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
