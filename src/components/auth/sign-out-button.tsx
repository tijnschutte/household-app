"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
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

// Confirmation guard: this lives as an icon in the header, one accidental
// tap away from a password re-entry on a phone.
export default function SignOutButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirmOpen(true)}
        aria-label="Uitloggen"
        className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
      >
        <LogOut className="w-5 h-5" />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uitloggen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je moet daarna opnieuw inloggen met je wachtwoord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => signOut()}>Uitloggen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
