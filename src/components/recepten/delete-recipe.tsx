"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
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

/**
 * The "Recept verwijderen" link at the foot of the edit form and the
 * confirmation it opens. Deleting lives on the edit page and not on the recipe
 * itself: it is rare and destructive, so it sits with the other management,
 * not under the text someone reads while cooking.
 */
export default function DeleteRecipe({
  title,
  onDelete,
  disabled,
}: {
  title: string;
  onDelete: () => Promise<void>;
  disabled: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      router.push("/recepten");
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <div className="flex justify-center pt-8">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled}
          className="h-9 px-2 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          Recept verwijderen
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !isDeleting && setConfirmOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title} verwijderen?</AlertDialogTitle>
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
    </>
  );
}
