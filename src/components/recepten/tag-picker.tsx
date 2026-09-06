"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { RecipeTagView } from "@/src/lib/recepten/view";

/**
 * The recipe's categories as a row of toggle chips, plus an inline field to
 * coin a new one. Which names are selected is the form's to keep (it goes out
 * with the save); which chips are on offer is ours, since a freshly coined
 * name must stay visible after it is toggled off again.
 */
export default function TagPicker({
  existingTags,
  selected,
  onChange,
  disabled,
}: {
  existingTags: RecipeTagView[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [options, setOptions] = useState<string[]>(() => existingTags.map((tag) => tag.name));
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const selectedSet = new Set(selected);

  const toggle = (name: string) => {
    onChange(selectedSet.has(name) ? selected.filter((tag) => tag !== name) : [...selected, name]);
  };

  const addNew = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    if (!selectedSet.has(trimmed)) onChange([...selected, trimmed]);
    setNewTagName("");
    setNewTagOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => toggle(name)}
          disabled={disabled}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedSet.has(name)
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {name}
        </button>
      ))}
      {newTagOpen ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNew();
              }
            }}
            placeholder="Nieuwe categorie"
            maxLength={30}
            className="h-8 w-32 rounded-full text-sm"
          />
          <Button type="button" size="sm" onClick={addNew} disabled={disabled}>
            Toevoegen
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNewTagOpen(true)}
          disabled={disabled}
          className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
        >
          + nieuw
        </button>
      )}
    </div>
  );
}
