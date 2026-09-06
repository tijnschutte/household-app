"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import TagChips from "@/src/components/recepten/tag-chips";
import { filterRecipes } from "@/src/lib/recepten/search";
import type { RecipeSummary, RecipeTagView } from "@/src/lib/recepten/view";

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function EmptyState({ hasRecipes }: { hasRecipes: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <p className="text-sm font-medium">
        {hasRecipes ? "Geen recepten gevonden" : "Nog geen recepten"}
      </p>
      {!hasRecipes && (
        <p className="max-w-xs text-sm">Voeg je eerste recept toe met de + rechtsboven.</p>
      )}
    </div>
  );
}

function RecipeRow({ recipe }: { recipe: RecipeSummary }) {
  const meta = [
    pluralize(recipe.ingredientNames.length, "ingrediënt", "ingrediënten"),
    pluralize(recipe.stepCount, "stap", "stappen"),
  ].join(" · ");

  return (
    <li>
      <Link
        href={`/recepten/${recipe.id}`}
        className="flex min-h-[52px] items-center gap-3 px-3.5 py-3 transition-colors active:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium first-letter:uppercase">{recipe.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {recipe.onList && <span className="text-primary">In mandje · </span>}
            {meta}
          </p>
        </div>
        {recipe.tags.length > 0 && (
          <div className="flex shrink-0 gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-primary"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    </li>
  );
}

export default function ReceptenPageClient({
  recipes,
  tags,
}: {
  recipes: RecipeSummary[];
  tags: RecipeTagView[];
}) {
  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const filtered = useMemo(
    () => filterRecipes(recipes, query, selectedTagIds),
    [recipes, query, selectedTagIds]
  );

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Recepten"
        left={<HuisButton />}
        right={
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
          >
            <Link href="/recepten/nieuw" aria-label="Nieuw recept">
              <Plus className="h-6 w-6" />
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-2xl shrink-0 space-y-3 px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op naam of ingrediënt…"
            aria-label="Zoek op naam of ingrediënt"
            className="h-12 pl-9"
          />
        </div>
        {tags.length > 0 && (
          <TagChips tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        )}
      </div>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
        {filtered.length === 0 ? (
          <EmptyState hasRecipes={recipes.length > 0} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {filtered.map((recipe) => (
              <RecipeRow key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
