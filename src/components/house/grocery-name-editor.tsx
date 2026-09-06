"use client";

import { MAX_ITEM_NAME_LENGTH } from "@/src/lib/house/grocery-view";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

/**
 * The inline rename field a row turns into. Mounted only while editing, so it
 * always opens on the row's current name; Enter or blur saves, Escape abandons.
 */
export function GroceryNameEditor({
  name,
  onSave,
  onCancel,
}: {
  name: string;
  /** Only called with a trimmed, non-empty name that differs from `name`. */
  onSave: (newName: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    // Length is the input's job (maxLength) and normalization the caller's, so
    // all that is decided here is whether there is a change worth saving.
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      save();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-white ring-1 ring-primary">
      <div className="h-[22px] w-[22px] flex-shrink-0" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        maxLength={MAX_ITEM_NAME_LENGTH}
        className="h-7 text-base border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
