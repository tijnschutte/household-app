"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBasket, Wallet, FolderOpen, House } from "lucide-react";

const tabs = [
  { href: "/home", label: "Mandje", icon: ShoppingBasket },
  { href: "/geld", label: "Geld", icon: Wallet },
  { href: "/docs", label: "Docs", icon: FolderOpen },
  { href: "/huis", label: "Huis", icon: House },
] as const;

// Platform-wide bottom navigation. Every module (tab) owns the area above it;
// the bar itself is the only element that carries the iOS home-indicator
// safe-area padding, so module footers (like the grocery add-bar) stack
// directly on top of it without double insets.
export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="w-full shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 w-full max-w-2xl grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
