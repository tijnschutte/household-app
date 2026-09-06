"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
import { rankBySharedIngredients } from "@/src/lib/recepten/similar";
import type { RecipeForSimilarity } from "@/src/lib/recepten/view";

const chip = (on: boolean) =>
  `h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors first-letter:uppercase ${
    on
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card text-foreground active:bg-accent"
  }`;

/**
 * Other recipes ranked by how many ingredients they share with this one, each
 * showing what is shared and what it would still need. The chip row narrows
 * to recipes that use one ingredient in particular.
 */
export default function SimilarRecipesClient({
  recipe,
  others,
}: {
  recipe: RecipeForSimilarity;
  others: RecipeForSimilarity[];
}) {
  const [required, setRequired] = useState<string | null>(null);
  const ranked = rankBySharedIngredients(recipe, others, required);

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Lijkt op" left={<BackButton />} />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div>
          <p className="text-xs text-muted-foreground">Recepten met ingrediënten uit</p>
          <h1 className="text-xl font-bold first-letter:uppercase">{recipe.title}</h1>
        </div>

        <div
          role="group"
          aria-label="Filter op ingrediënt"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
        >
          <button
            type="button"
            aria-pressed={required === null}
            onClick={() => setRequired(null)}
            className={chip(required === null)}
          >
            Alle ingrediënten
          </button>
          {recipe.ingredientNames.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={required === name}
              onClick={() => setRequired(required === name ? null : name)}
              className={chip(required === name)}
            >
              {name}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {required === null
              ? "Nog geen recept dat ingrediënten deelt met dit recept"
              : `Geen ander recept met ${required}`}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {ranked.map((similar) => (
              <li key={similar.recipeId}>
                <Link
                  href={`/recepten/${similar.recipeId}`}
                  className="block p-3.5 transition-colors active:bg-accent"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] font-semibold first-letter:uppercase">
                      {similar.title}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
                      {similar.shared.length} van {similar.ingredientCount} gedeeld
                    </span>
                  </div>
                  <div className="mt-2 flex gap-[3px]" aria-hidden>
                    {Array.from({ length: similar.ingredientCount }, (_, i) => (
                      <i
                        key={i}
                        className={`h-1 flex-1 rounded-sm ${i < similar.shared.length ? "bg-primary" : "bg-border"}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {similar.shared.map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {name}
                      </span>
                    ))}
                    {similar.missing.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {similar.missing.length === 0
                      ? "Niets extra nodig"
                      : `Nog ${similar.missing.length} nodig`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {ranked.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Gesorteerd op gedeelde ingrediënten
          </p>
        )}
      </main>
    </div>
  );
}
