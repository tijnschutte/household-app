"use client";

import { useState } from "react";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { RecipeFormValues } from "@/src/lib/recepten/recipe-form-lines";
import type { IngredientName } from "@/src/lib/recepten/view";

/**
 * One ingredient line of the recipe form: a name with autocomplete over the
 * household's existing ingredient names, a quantity, a unit, and a remove
 * button. Owns only whether its suggestion list is open; the values live in
 * the form.
 */
export default function IngredientRow({
  index,
  control,
  register,
  ingredientNames,
  nameError,
  quantityError,
  onRemove,
  canRemove,
  disabled,
}: {
  index: number;
  control: Control<RecipeFormValues>;
  register: UseFormRegister<RecipeFormValues>;
  ingredientNames: IngredientName[];
  nameError?: string;
  quantityError?: string;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-1.5">
      <Controller
        control={control}
        name={`ingredients.${index}.name`}
        render={({ field }) => {
          const query = field.value.trim().toLowerCase();
          const matches = query
            ? ingredientNames.filter((ingredient) => ingredient.name.includes(query)).slice(0, 6)
            : [];
          const exists = ingredientNames.some((ingredient) => ingredient.name === query);

          return (
            <div className="relative min-w-0 flex-1">
              <Input
                {...field}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                onBlur={() => {
                  field.onBlur();
                  // Give a suggestion's onMouseDown time to fire before the list unmounts.
                  setTimeout(() => setOpen(false), 150);
                }}
                maxLength={40}
                disabled={disabled}
                aria-label="Ingrediëntnaam"
                aria-invalid={!!nameError}
              />
              {open && query && (matches.length > 0 || !exists) && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card py-1 shadow-lg">
                  {matches.map((ingredient) => (
                    <button
                      type="button"
                      key={ingredient.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        field.onChange(ingredient.name);
                        setOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {ingredient.name}
                    </button>
                  ))}
                  {!exists && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
                    >
                      + &quot;{field.value.trim()}&quot; toevoegen
                    </button>
                  )}
                </div>
              )}
              {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
            </div>
          );
        }}
      />
      <div className="w-16 shrink-0">
        <Input
          {...register(`ingredients.${index}.quantity`)}
          inputMode="decimal"
          maxLength={8}
          disabled={disabled}
          aria-label="Hoeveelheid"
          aria-invalid={!!quantityError}
        />
        {quantityError && <p className="mt-1 text-xs text-destructive">{quantityError}</p>}
      </div>
      <Input
        {...register(`ingredients.${index}.unit`)}
        maxLength={12}
        disabled={disabled}
        aria-label="Eenheid"
        className="w-16 shrink-0"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled || !canRemove}
        aria-label="Ingrediënt verwijderen"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
