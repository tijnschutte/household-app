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
import { createCategory } from "@/src/lib/actions";
import { toast } from "sonner";

type AddCategoryProps = {
  userId: number;
  householdId: number | undefined;
  showPersonal: boolean;
  onCategoryAdded: () => void;
};

export default function AddCategory({ userId, householdId, showPersonal, onCategoryAdded }: AddCategoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      toast.error("Voer een categorienaam in");
      return;
    }

    setIsCreating(true);
    try {
      await createCategory(
        categoryName,
        showPersonal ? userId : undefined,
        showPersonal ? undefined : householdId
      );
      toast.success(`Categorie "${categoryName}" aangemaakt`);
      setCategoryName("");
      setIsOpen(false);
      onCategoryAdded();
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
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-all">
          <Plus className="h-4 w-4" />
          Categorie toevoegen
        </Button>
      </DialogTrigger>
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
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating} className="active:scale-95 transition-all">
              Annuleren
            </Button>
            <Button type="submit" disabled={isCreating} className="active:scale-95 transition-all">
              {isCreating ? "Aanmaken..." : "Categorie aanmaken"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
