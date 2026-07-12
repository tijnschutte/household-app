"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/src/components/ui/button";

// Header back affordance for pages opened from another module's header
// (like /huis) rather than from the tab bar. Falls back to the grocery list
// when there is no in-app history (e.g. a direct deep link).
export default function BackButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Terug"
      className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
    >
      <ChevronLeft className="h-5 w-5" />
    </Button>
  );
}
