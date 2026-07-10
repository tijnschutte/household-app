"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/src/components/ui/button";

export default function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => signOut()}
      aria-label="Uitloggen"
      className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
    >
      <LogOut className="w-5 h-5" />
    </Button>
  );
}
