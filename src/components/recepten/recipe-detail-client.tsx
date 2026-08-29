"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, ShoppingBasket, Check } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
import { Button } from "@/src/components/ui/button";
import { formatQuantity } from "@/src/lib/quantity";
import type { RecipeDetail } from "@/src/lib/recepten/view";

type Segment = "ingredienten" | "recept";

/** Confirmed ~2s: long enough to register as feedback, short enough not to strand the button. */
const CONFIRMATION_MS = 2000;

export type RecipeDetailActions = {
  onAddToBasket: (recipeId: number) => Promise<void>;
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

function paragraphs(instructions: string): string[] {
  return instructions
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export default function RecipeDetailClient({
  recipe,
  onAddToBasket,
}: { recipe: RecipeDetail } & RecipeDetailActions) {
  const [segment, setSegment] = useState<Segment>("ingredienten");
  const [basketState, setBasketState] = useState<"idle" | "pending" | "done">("idle");

  const handleAddToBasket = async () => {
    setBasketState("pending");
    try {
      await onAddToBasket(recipe.id);
      setBasketState("done");
      setTimeout(() => setBasketState("idle"), CONFIRMATION_MS);
    } catch (error) {
      console.error("Failed to add recipe to basket:", error);
      setBasketState("idle");
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title={recipe.title}
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
          <ul className="divide-y divide-border">
            {recipe.ingredients.map((ingredient) => {
              const label = formatQuantity(ingredient.quantity, ingredient.unit);
              return (
                <li
                  key={ingredient.name}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 truncate first-letter:uppercase">{ingredient.name}</span>
                  {label && (
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-4">
            {paragraphs(recipe.instructions).length > 0 ? (
              paragraphs(recipe.instructions).map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Geen bereiding toegevoegd.</p>
            )}
          </div>
        )}
      </main>

      <footer className="w-full shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          <Button
            type="button"
            onClick={handleAddToBasket}
            disabled={basketState === "pending"}
            className={`h-12 w-full gap-2 ${basketState === "done" ? "bg-green-600 hover:bg-green-600" : ""}`}
          >
            {basketState === "done" ? (
              <>
                <Check className="h-5 w-5" data-icon="inline-start" />
                In mandje
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
    </div>
  );
}
