"use client";

import type { RecipeTagView } from "@/src/lib/recepten/view";

/**
 * The tag filter as one scrolling row of chips: "Alles" plus one per tag.
 * Several chips can be on at once and narrow together (recepten/search.ts);
 * "Alles" is what an empty selection looks like, and tapping it clears one.
 */
export default function TagChips({
  tags,
  selectedIds,
  onChange,
}: {
  tags: RecipeTagView[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
}) {
  const selected = new Set(selectedIds);
  const toggle = (id: number) =>
    onChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);

  return (
    <div
      role="group"
      aria-label="Filter op categorie"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
    >
      <Chip on={selectedIds.length === 0} onClick={() => onChange([])}>
        Alles
      </Chip>
      {tags.map((tag) => (
        <Chip key={tag.id} on={selected.has(tag.id)} onClick={() => toggle(tag.id)}>
          {tag.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium transition-colors ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground active:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
