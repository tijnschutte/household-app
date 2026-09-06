"use client";

import type { Category } from "@prisma/client";
import { useRef, useState, type RefObject } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/src/components/ui/select";
import AddCategory, { type AddCategoryActions } from "@/src/components/add-category";
import { MAX_ITEM_NAME_LENGTH, parseItemName, type ViewKey } from "@/src/lib/house/grocery-view";

type AddBarProps = {
  view: ViewKey;
  categories: Category[];
  /**
   * Where the next item lands; null is "Geen categorie". The page owns it,
   * because a category header's "+" sets it from outside this bar.
   */
  targetCategory: Category | null;
  onTargetCategoryChange: (categoryId: number | null) => void;
  /** A valid, normalized name and the category it should land in. */
  onAdd: (name: string, category: Category | null) => void;
  /** Made from the picker's "+ Nieuwe categorie"; the page adds it to its list. */
  onCategoryCreated: (category: Category) => void;
  /** The page holds the ref, so a category header's "+" can focus the input. */
  inputRef: RefObject<HTMLInputElement | null>;
} & AddCategoryActions;

/**
 * The one place items are typed in: a category chip, the input, and the add
 * button, plus the dialog the chip's "+ Nieuwe categorie" opens. What it hands
 * up is already a valid item name; the optimistic insert is the page's story.
 */
export default function AddBar({
  view,
  categories,
  targetCategory,
  onTargetCategoryChange,
  onAdd,
  onCategoryCreated,
  onCreateCategory,
  inputRef,
}: AddBarProps) {
  const [itemName, setItemName] = useState("");
  // The picker's "+ Nieuwe categorie" option is the one place to create
  // categories; it opens this controlled dialog.
  const [pickerAddOpen, setPickerAddOpen] = useState(false);
  // Which of the two inputs the picker hands the caret to as it closes. A ref,
  // not `pickerAddOpen`: Radix fires close-autofocus from a handler captured a
  // render earlier, so the state it would read is still the pre-choice one.
  const dialogWantsCaretRef = useRef(false);

  const submit = () => {
    // Same rule as the inline rename: one definition of what an item may be
    // called, and the normalization it mirrors from the server.
    const parsed = parseItemName(itemName);
    if (!parsed.ok) {
      toast.error(parsed.message);
      inputRef.current?.focus();
      return;
    }
    onAdd(parsed.name, targetCategory);
    // The input clears and keeps focus, so the next item can be typed while
    // the server is still catching up on this one.
    setItemName("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex flex-row justify-center items-center gap-2 w-full max-w-2xl mx-auto">
      <div className="flex flex-1 min-w-0 items-center gap-1 h-12 bg-card rounded-lg border border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 transition-colors pl-1.5">
        {/* Category chip: where the next added item lands. Sticky across
            consecutive adds; resets when switching lists. */}
        <Select
          value={targetCategory ? String(targetCategory.id) : "none"}
          onValueChange={(value) => {
            if (value === "new") {
              dialogWantsCaretRef.current = true;
              setPickerAddOpen(true);
              return;
            }
            onTargetCategoryChange(value === "none" ? null : Number(value));
          }}
        >
          {/* Compact chip: icon + chevron only while no category is
              targeted; a short truncated name (max 35% of the bar) once
              one is. The input keeps the majority of the row. */}
          <SelectTrigger
            aria-label="Categorie voor nieuwe items"
            className={
              targetCategory
                ? "h-8 max-w-[50%] shrink-0 gap-1 rounded-md border-0 bg-secondary px-2 text-xs font-medium text-muted-foreground shadow-none"
                : "h-8 w-11 shrink-0 justify-center gap-0.5 rounded-md border-0 bg-secondary px-0 text-muted-foreground shadow-none"
            }
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            {targetCategory && <span className="truncate">{targetCategory.name}</span>}
          </SelectTrigger>
          <SelectContent
            side="top"
            align="start"
            sideOffset={10}
            className="min-w-48 rounded-2xl border-border p-1.5 shadow-lg"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              // "+ Nieuwe categorie" leaves a dialog open on top, and its
              // name field is what the user is about to type into.
              if (dialogWantsCaretRef.current) {
                dialogWantsCaretRef.current = false;
                return;
              }
              // After picking a category, put the caret straight back in
              // the item input so the user can type the item name.
              inputRef.current?.focus();
            }}
          >
            <SelectItem value="none" className="rounded-lg py-2.5">
              Geen categorie
            </SelectItem>
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                value={String(category.id)}
                className="rounded-lg py-2.5"
              >
                {category.name}
              </SelectItem>
            ))}
            <SelectItem value="new" className="rounded-lg py-2.5 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nieuwe categorie
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <AddCategory
          view={view}
          open={pickerAddOpen}
          onOpenChange={setPickerAddOpen}
          onCreateCategory={onCreateCategory}
          onCategoryAdded={(category) => {
            // Target the fresh category right away — the user was mid-add.
            onCategoryCreated(category);
            onTargetCategoryChange(category.id);
            inputRef.current?.focus();
          }}
        />
        <Input
          ref={inputRef}
          className="flex-1 min-w-0 h-full border-0 shadow-none bg-transparent px-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Voeg een item toe..."
          value={itemName}
          maxLength={MAX_ITEM_NAME_LENGTH}
          onChange={(e) => setItemName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <Button
        size="icon"
        aria-label="Item toevoegen"
        onMouseDown={(e) => {
          e.preventDefault();
          submit();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          submit();
        }}
        className="h-12 w-12 active:opacity-70"
      >
        <Plus />
      </Button>
    </div>
  );
}
