"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleTabs, type OptionalModule } from "@/src/lib/modules/modules";

// Platform-wide bottom navigation. Every module (tab) owns the area above it;
// the bar itself is the only element that carries the iOS home-indicator
// safe-area padding, so module footers (like the grocery add-bar) stack
// directly on top of it without double insets.
//
// The layout passes the hidden modules rather than the tabs themselves: a tab
// carries its icon, an icon is a component, and a component has nothing to
// serialize across the Server/Client boundary. So the plain enum values cross
// and the catalogue is read on this side.
export default function BottomTabBar({ hiddenModules }: { hiddenModules: OptionalModule[] }) {
  const tabs = visibleTabs(hiddenModules);
  const pathname = usePathname();
  // Highlight the tapped tab immediately; the server-rendered page can take a
  // moment to arrive and pathname only updates once it has. The tap remembers
  // the pathname it happened on, so it stops counting the moment that changes.
  const [tap, setTap] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = tap && tap.from === pathname ? tap.href : null;

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="w-full shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className="mx-auto grid h-16 w-full max-w-2xl"
        // Column count follows the tabs, so hiding one widens the rest rather
        // than leaving a gap. Inline because Tailwind cannot generate a class
        // from a value only known at runtime.
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          const active = pendingHref ? pendingHref === href : current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              onClick={() => setTap({ href, from: pathname })}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:bg-accent ${
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
