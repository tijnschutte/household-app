"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Search } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import HuisButton from "@/src/components/huis-button";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { filterRecipes } from "@/src/lib/recepten/search";
import type { RecipeSummary, RecipeTagView } from "@/src/lib/recepten/view";

/** The trigger reads as the selection itself, so the filter is visible without opening it. */
function tagFilterLabel(tags: RecipeTagView[], selected: Set<number>): string {
  const names = tags.filter((tag) => selected.has(tag.id)).map((tag) => tag.name);
  if (names.length === 0) return "Alle categorieën";
  if (names.length <= 2) return names.join(", ");
  return `${names.length} categorieën`;
}

function TagFilter({
  tags,
  selected,
  onChange,
}: {
  tags: RecipeTagView[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal"
          aria-label="Filter op categorie"
        >
          <span className={selected.size === 0 ? "text-muted-foreground" : undefined}>
            {tagFilterLabel(tags, selected)}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {tags.map((tag) => (
          <DropdownMenuCheckboxItem
            key={tag.id}
            checked={selected.has(tag.id)}
            onCheckedChange={() => toggle(tag.id)}
            // Stay open so several can be ticked in one go.
            onSelect={(event) => event.preventDefault()}
          >
            {tag.name}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(new Set())}>Alles tonen</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ hasRecipes }: { hasRecipes: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <p className="text-sm font-medium">
        {hasRecipes ? "Geen recepten gevonden" : "Nog geen recepten"}
      </p>
      {!hasRecipes && (
        <p className="max-w-xs text-sm">Voeg je eerste recept toe met de knop rechtsonder.</p>
      )}
    </div>
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
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  const filtered = useMemo(
    () => filterRecipes(recipes, query, [...selectedTagIds]),
    [recipes, query, selectedTagIds]
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      <PageHeader title="Recepten" right={<HuisButton />} />

      <div className="w-full max-w-2xl mx-auto shrink-0 space-y-3 px-4 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op titel…"
            aria-label="Zoek op titel"
            className="pl-9"
          />
        </div>
        {tags.length > 0 && (
          <TagFilter tags={tags} selected={selectedTagIds} onChange={setSelectedTagIds} />
        )}
      </div>

      <main className="w-full max-w-2xl mx-auto flex-1 overflow-y-auto px-4 py-4">
        {filtered.length === 0 ? (
          <EmptyState hasRecipes={recipes.length > 0} />
        ) : (
          <ul className="space-y-2">
            {filtered.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/recepten/${recipe.id}`}
                  className="block rounded-lg border border-border bg-card p-3 transition-colors active:bg-accent"
                >
                  <p className="font-medium first-letter:uppercase">{recipe.title}</p>
                  {recipe.tags.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {recipe.tags.map((t) => t.name).join(", ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Button
        asChild
        size="icon"
        className="absolute bottom-4 right-4 h-14 w-14 rounded-full shadow-lg"
      >
        <Link href="/recepten/nieuw" aria-label="Nieuw recept">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>
    </div>
  );
}
