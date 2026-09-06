"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import type { RecipeTagView } from "@/src/lib/recepten/view";

/**
 * The recipe's tags as a row of toggle chips, plus an inline field to coin a
 * new one. Which names are selected is the form's to keep (it goes out with
 * the save); which chips are on offer is ours, since a freshly coined name
 * must stay visible after it is toggled off again.
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
    if (!trimmed) {
      setNewTagOpen(false);
      return;
    }
    setOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    if (!selectedSet.has(trimmed)) onChange([...selected, trimmed]);
    setNewTagName("");
    setNewTagOpen(false);
  };

  const chip = "h-7 rounded-full px-2.5 text-xs font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={selectedSet.has(name)}
          onClick={() => toggle(name)}
          disabled={disabled}
          className={`${chip} ${
            selectedSet.has(name)
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-foreground"
          }`}
        >
          {name}
        </button>
      ))}
      {newTagOpen ? (
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
          onBlur={addNew}
          placeholder="Nieuwe tag"
          aria-label="Nieuwe tag"
          maxLength={30}
          className="h-7 w-32 rounded-full text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setNewTagOpen(true)}
          disabled={disabled}
          className={`${chip} flex items-center gap-1 border border-dashed border-border text-muted-foreground`}
        >
          <Plus className="h-3 w-3" />
          Tag
        </button>
      )}
    </div>
  );
}
