"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, ShoppingBasket, Check, ChevronRight } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { formatQuantity } from "@/src/lib/quantity";
import { suggestRecipes, type RecipeForSuggestion } from "@/src/lib/recepten/suggestions";
import type { RecipeDetail } from "@/src/lib/recepten/view";

type Segment = "ingredienten" | "recept";

/** Confirmed ~2s: long enough to register as feedback, short enough not to strand the button. */
const CONFIRMATION_MS = 2000;

export type RecipeDetailActions = {
  onAddToBasket: (recipeId: number) => Promise<void>;
  onLoadSuggestions: (recipeId: number) => Promise<RecipeForSuggestion[]>;
};

function SegmentedControl({
  segment,
  onChange,
}: {
  segment: Segment;
  onChange: (s: Segment) => void;
}) {
  const isRecept = segment === "recept";
  return (
    <div
      role="tablist"
      aria-label="Onderdeel"
      className="relative flex w-full rounded-lg bg-secondary p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: isRecept ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={!isRecept}
        onClick={() => onChange("ingredienten")}
        className={`relative z-10 h-11 flex-1 rounded-md text-sm font-medium transition-colors ${
          !isRecept ? "text-primary" : "text-muted-foreground"
        }`}
      >
        Ingrediënten
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isRecept}
        onClick={() => onChange("recept")}
        className={`relative z-10 h-11 flex-1 rounded-md text-sm font-medium transition-colors ${
          isRecept ? "text-primary" : "text-muted-foreground"
        }`}
      >
        Recept
      </button>
    </div>
  );
}

/**
 * A paragraph has no id of its own, so its position in the instructions text
 * stands in for one: unique among siblings even when two paragraphs read the
 * same, and stable for as long as the text is.
 */
type Paragraph = { offset: number; text: string };

function paragraphs(instructions: string): Paragraph[] {
  const result: Paragraph[] = [];
  let offset = 0;
  // The capturing group keeps the separators in the output, so the offset
  // stays right without knowing how many blank lines sat between paragraphs.
  for (const piece of instructions.split(/(\n\s*\n)/)) {
    const text = piece.trim();
    if (text) result.push({ offset, text });
    offset += piece.length;
  }
  return result;
}

/**
 * Other recipes worth shopping for in the same trip, because they share
 * ingredients with this one. Reached from the ingredient list itself rather
 * than a button of its own — see suggestions.ts for the ranking.
 */
function SharedIngredientsSheet({
  open,
  onOpenChange,
  recipe,
  onLoadSuggestions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: RecipeDetail;
  onLoadSuggestions: (recipeId: number) => Promise<RecipeForSuggestion[]>;
}) {
  const [others, setOthers] = useState<RecipeForSuggestion[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    onLoadSuggestions(recipe.id)
      .then((loaded) => {
        if (!cancelled) setOthers(loaded);
      })
      .catch((error) => {
        console.error("Failed to load recipe suggestions:", error);
        if (!cancelled) setOthers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, recipe.id, onLoadSuggestions]);

  const suggestions = useMemo(() => {
    if (others === null) return null;
    const self = {
      id: recipe.id,
      title: recipe.title,
      ingredientNames: recipe.ingredients.map((i) => i.name),
    };
    return suggestRecipes(self, others);
  }, [others, recipe]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[75vh] flex-col gap-0 overflow-hidden">
        <SheetHeader>
          <SheetTitle>Deelt ingrediënten met</SheetTitle>
          <SheetDescription>Recepten om samen met {recipe.title} in te kopen</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {suggestions === null ? (
            <p className="py-4 text-sm text-muted-foreground">Laden…</p>
          ) : suggestions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nog geen recept dat ingrediënten deelt met dit recept
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.recipeId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium first-letter:uppercase">
                      {suggestion.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      deelt: {suggestion.shared.join(", ")}
                    </p>
                  </div>
                  <Link
                    href={`/recepten/${suggestion.recipeId}`}
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

export default function RecipeDetailClient({
  recipe,
  onAddToBasket,
  onLoadSuggestions,
}: { recipe: RecipeDetail } & RecipeDetailActions) {
  const [segment, setSegment] = useState<Segment>("ingredienten");
  const [basketState, setBasketState] = useState<"idle" | "pending" | "done">("idle");
  // The server already knew the answer at render time (recipe.onList); this
  // only tracks what happened since, so "Al in mandje" doesn't need a refetch
  // to appear once the flash ends.
  const [wasAdded, setWasAdded] = useState(false);
  const [confirmReAddOpen, setConfirmReAddOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const alreadyOnList = recipe.onList || wasAdded;
  const instructionParagraphs = paragraphs(recipe.instructions);

  const runAddToBasket = async () => {
    setBasketState("pending");
    try {
      await onAddToBasket(recipe.id);
      setBasketState("done");
      setWasAdded(true);
      setTimeout(() => setBasketState("idle"), CONFIRMATION_MS);
    } catch (error) {
      console.error("Failed to add recipe to basket:", error);
      setBasketState("idle");
    }
  };

  const handleBasketClick = () => {
    // Already on the list: ask first, since tapping again would double the
    // quantities rather than just re-confirming what's already there (D2).
    if (alreadyOnList) {
      setConfirmReAddOpen(true);
      return;
    }
    runAddToBasket();
  };

  const handleConfirmReAdd = () => {
    setConfirmReAddOpen(false);
    runAddToBasket();
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Recepten"
        left={<BackButton />}
        right={
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
          >
            <Link href={`/recepten/${recipe.id}/bewerken`} aria-label="Recept bewerken">
              <Pencil className="h-5 w-5" />
            </Link>
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <h1 className="text-xl font-bold first-letter:uppercase">{recipe.title}</h1>

        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-secondary px-3 py-1.5 text-sm text-muted-foreground"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <SegmentedControl segment={segment} onChange={setSegment} />

        {segment === "ingredienten" ? (
          <div className="space-y-4">
            <ul className="divide-y divide-border">
              {recipe.ingredients.map((ingredient) => {
                const label = formatQuantity(ingredient.quantity, ingredient.unit);
                return (
                  <li
                    key={ingredient.name}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 truncate first-letter:uppercase">
                      {ingredient.name}
                    </span>
                    {label && (
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => setSuggestOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors active:bg-accent"
            >
              Deelt ingrediënten met andere recepten
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {instructionParagraphs.length > 0 ? (
              instructionParagraphs.map((paragraph) => (
                <p key={paragraph.offset} className="text-sm leading-relaxed whitespace-pre-wrap">
                  {paragraph.text}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Geen bereiding toegevoegd.</p>
            )}
          </div>
        )}
      </main>

      <footer className="w-full shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Button
            type="button"
            onClick={handleBasketClick}
            disabled={basketState === "pending"}
            variant={basketState !== "done" && alreadyOnList ? "outline" : "default"}
            className={`h-12 flex-1 gap-2 ${
              basketState === "done" ? "bg-green-600 text-white hover:bg-green-600" : ""
            }`}
          >
            {basketState === "done" ? (
              <>
                <Check className="h-5 w-5" data-icon="inline-start" />
                In mandje
              </>
            ) : alreadyOnList ? (
              <>
                <Check className="h-5 w-5" data-icon="inline-start" />
                Al in mandje
              </>
            ) : (
              <>
                <ShoppingBasket className="h-5 w-5" data-icon="inline-start" />
                In mandje
              </>
            )}
          </Button>
        </div>
      </footer>

      <AlertDialog open={confirmReAddOpen} onOpenChange={setConfirmReAddOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nog een keer toevoegen?</AlertDialogTitle>
            <AlertDialogDescription>
              De hoeveelheden worden bij elkaar opgeteld.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReAdd}>Toevoegen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SharedIngredientsSheet
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        recipe={recipe}
        onLoadSuggestions={onLoadSuggestions}
      />
    </div>
  );
}
