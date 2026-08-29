"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { matchRecipesToList, type RecipeForMatch } from "@/src/lib/recepten/list-match";

export type ListMatchSheetActions = {
  onLoadRecipesForMatch: () => Promise<RecipeForMatch[]>;
};

function missingLabel(missing: string[]): string {
  const shown = missing.slice(0, 3).join(", ");
  return missing.length > 3 ? `${shown}…` : shown;
}

/**
 * "Past bij je lijstje": which recipes the household is closest to already
 * having on the shared list. Lives in components/recepten/ rather than
 * components/house/ — the home screen composes it, but house/ itself must
 * never import from recepten/ (see .dependency-cruiser.cjs).
 */
export default function ListMatchSheet({
  open,
  onOpenChange,
  listNames,
  onLoadRecipesForMatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names on the household's shared list, bought items included. */
  listNames: string[];
} & ListMatchSheetActions) {
  const [recipes, setRecipes] = useState<RecipeForMatch[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    onLoadRecipesForMatch()
      .then((loaded) => {
        if (!cancelled) setRecipes(loaded);
      })
      .catch((error) => {
        console.error("Failed to load recipes for list match:", error);
        if (!cancelled) setRecipes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, onLoadRecipesForMatch]);

  const matches = useMemo(
    () => (recipes === null ? null : matchRecipesToList(listNames, recipes)),
    [recipes, listNames]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[75vh] flex-col gap-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Past bij je lijstje</SheetTitle>
          <SheetDescription>Recepten waarvan je het meeste al op de lijst hebt</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {matches === null ? (
            <p className="py-4 text-sm text-muted-foreground">Laden…</p>
          ) : matches.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nog geen recept dat bij je lijstje past
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((match) => (
                <li key={match.recipeId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium first-letter:uppercase">
                      {match.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {match.missing.length === 0
                        ? `${match.have} van ${match.total} al op de lijst`
                        : `${match.have} van ${match.total} · nog: ${missingLabel(match.missing)}`}
                    </p>
                  </div>
                  <Link
                    href={`/recepten/${match.recipeId}`}
                    className="shrink-0 text-sm font-medium text-primary"
                  >
                    Bekijken ›
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
