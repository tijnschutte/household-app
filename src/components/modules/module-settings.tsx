"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Switch } from "@/src/components/ui/switch";
import { OPTIONAL_MODULES, type OptionalModule } from "@/src/lib/modules/modules";

/**
 * The one operation this card needs, owned here rather than imported from the
 * action module: the server page passes the real server action in, and a test
 * passes a fake. Keeps Prisma out of anything that renders this.
 */
export type ModuleSettingsActions = {
  onSetModuleHidden: (module: OptionalModule, hidden: boolean) => Promise<void>;
};

type ModuleSettingsProps = {
  /** The modules this person switched off; everything else is shown. */
  hiddenModules: OptionalModule[];
} & ModuleSettingsActions;

export default function ModuleSettings({ hiddenModules, onSetModuleHidden }: ModuleSettingsProps) {
  const [hidden, setHidden] = useState(() => new Set(hiddenModules));
  const router = useRouter();

  const switchModule = async (name: OptionalModule, wanted: boolean) => {
    // Optimistic: flip locally, revert on failure. Same pattern as checking an
    // item off the list.
    const apply = (isHidden: boolean) =>
      setHidden((previous) => {
        const next = new Set(previous);
        if (isHidden) next.add(name);
        else next.delete(name);
        return next;
      });

    apply(!wanted);
    try {
      await onSetModuleHidden(name, !wanted);
      // The bar lives in the layout, which this navigation-less change would
      // otherwise leave untouched until a full reload.
      router.refresh();
    } catch (error) {
      apply(wanted);
      console.error("Failed to save module preference:", error);
      toast.error("Opslaan mislukt");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Tabbladen
        </CardTitle>
        <CardDescription>
          Kies wat je onderin ziet. Deze keuze geldt voor al je apparaten; het mandje blijft altijd
          staan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {Object.entries(OPTIONAL_MODULES).map(([key, tab]) => {
          const name = key as OptionalModule;
          return (
            <div key={name} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{tab.label}</p>
                <p className="text-sm text-muted-foreground">{tab.description}</p>
              </div>
              <Switch
                aria-label={tab.label}
                checked={!hidden.has(name)}
                onCheckedChange={(wanted) => switchModule(name, wanted)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
