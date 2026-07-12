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
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Plus } from "lucide-react";
import { Category } from "@prisma/client";
import { createCategory } from "@/src/lib/actions";
import { toast } from "sonner";

type AddCategoryProps = {
  showPersonal: boolean;
  onCategoryAdded: (category: Category) => void;
  /** Custom dialog trigger, rendered via asChild. Defaults to the outline button. */
  trigger?: React.ReactNode;
  /** Controlled mode (no trigger rendered): open the dialog from elsewhere,
      e.g. the add-bar's category picker. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function AddCategory({
  showPersonal,
  onCategoryAdded,
  trigger,
  open,
  onOpenChange,
}: AddCategoryProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    // The dialog stays mounted, so drop a cancelled attempt's text on close.
    if (!next) setCategoryName("");
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast.error("Voer een categorienaam in");
      return;
    }

    setIsCreating(true);
    try {
      const category = await createCategory(categoryName, showPersonal);
      toast.success(`Categorie "${categoryName}" aangemaakt`);
      setCategoryName("");
      setIsOpen(false);
      onCategoryAdded(category);
    } catch (error) {
      console.error("Failed to create category:", error);
      const errorMessage = error instanceof Error ? error.message : "Aanmaken categorie mislukt";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Categorie toevoegen
            </Button>
          )}
        </DialogTrigger>
      )}
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
