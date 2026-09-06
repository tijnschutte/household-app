import type { OptionalModule } from "@prisma/client";
import { ShoppingBasket, Wallet, CookingPot, type LucideIcon } from "lucide-react";

/**
 * The catalogue of tabs, and the rule for which of them a given person sees.
 *
 * Both screens that care read this one file: the bottom bar renders the tabs,
 * the settings card renders a switch per optional module. Adding a module is
 * meant to be one edit here plus a route — anything else and a module can ship
 * visible but unswitchable, or switchable but unreachable.
 *
 * Prisma's enum is imported as a *type* only. Importing it as a value drags
 * Prisma's browser runtime into every bundle that renders a tab bar, which is
 * all of them (see recurring-kind.ts, same trade).
 */

export type ModuleTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The shared list. It is what the app is for, so it has no switch. */
const CORE_TAB: ModuleTab = {
  href: "/home",
  label: "Mandje",
  icon: ShoppingBasket,
};

/** Everything beside the list, in the order the bar shows them. */
export const OPTIONAL_MODULES = {
  GELD: {
    href: "/geld",
    label: "Geld",
    description: "De pot van het huishouden: wie legt in, wat gaat eruit",
    icon: Wallet,
  },
  RECEPTEN: {
    href: "/recepten",
    label: "Recepten",
    description: "Recepten van het huishouden, zo in je mandje",
    icon: CookingPot,
  },
  // Tripwire: Record demands a key per module in the schema, so adding one to
  // the enum stops this compiling rather than shipping a tab nobody can hide.
} as const satisfies Record<OptionalModule, ModuleTab & { description: string }>;

export const ALL_MODULES = Object.keys(OPTIONAL_MODULES) as OptionalModule[];

/**
 * The tabs this person gets. Hiding is a display choice, not a permission:
 * the routes stay reachable, so a bookmark or a notification deep-link still
 * works for someone who took the tab off their bar.
 */
export function visibleTabs(hiddenModules: OptionalModule[]): ModuleTab[] {
  const hidden = new Set(hiddenModules);
  // Bound as `name`, not `module`: Next reserves that identifier.
  return [
    CORE_TAB,
    ...ALL_MODULES.flatMap((name) => (hidden.has(name) ? [] : [OPTIONAL_MODULES[name]])),
  ];
}

export type { OptionalModule };
