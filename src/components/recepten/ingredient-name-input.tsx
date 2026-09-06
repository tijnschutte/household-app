"use client";

import { useState, type KeyboardEvent, type RefObject } from "react";
import { Input } from "@/src/components/ui/input";
import type { IngredientName } from "@/src/lib/recepten/view";

/**
 * The name field of the ingredient entry row, with autocomplete over the
 * household's existing ingredient names. Picking a suggestion is what keeps
 * "Lijkt op" and the list merge honest: both match on the exact name, so the
 * cheapest moment to spell it the same way is while typing it.
 */
export default function IngredientNameInput({
  value,
  onChange,
  onEnter,
  ingredientNames,
  inputRef,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onEnter: () => void;
  ingredientNames: IngredientName[];
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const matches = query
    ? ingredientNames
        .filter((ingredient) => ingredient.name.includes(query) && ingredient.name !== query)
        .slice(0, 6)
    : [];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
      onEnter();
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        // Give a suggestion's onMouseDown time to fire before the list unmounts.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        maxLength={40}
        disabled={disabled}
        placeholder="ingrediënt"
        aria-label="Ingrediënt"
        aria-invalid={invalid}
        className="h-12"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card py-1 shadow-lg">
          {matches.map((ingredient) => (
            <li key={ingredient.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(ingredient.name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm first-letter:uppercase hover:bg-accent"
              >
                {ingredient.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
