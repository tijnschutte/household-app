import Link from "next/link";
import { House } from "lucide-react";
import { Button } from "@/src/components/ui/button";

// Header entry point to the household page (/huis) now that it no longer has
// its own tab. Lives in a PageHeader side slot on every module.
export default function HuisButton() {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
    >
      <Link href="/huis" aria-label="Huis">
        <House className="h-5 w-5" />
      </Link>
    </Button>
  );
}
