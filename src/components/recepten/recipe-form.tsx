"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import IngredientNameInput from "@/src/components/recepten/ingredient-name-input";
import StepEditor from "@/src/components/recepten/step-editor";
import TagPicker from "@/src/components/recepten/tag-picker";
import { formatQuantity } from "@/src/lib/quantity";
import { recipeSchema, type RecipeInput } from "@/src/lib/recepten/schema";
import {
  emptyDraft,
  parseDraft,
  withTrailingBlank,
  type DraftError,
  type IngredientDraft,
} from "@/src/lib/recepten/recipe-form-lines";
import type { IngredientName, RecipeIngredientView, RecipeTagView } from "@/src/lib/recepten/view";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * What this form can do, owned here rather than imported from the action
 * module: the server page passes createRecipe/updateRecipe in (already
 * translated to this shape), and a test passes a fake. Keeps Prisma out of
 * anything that renders this.
 */
export type RecipeFormActions = {
  onSubmit: (input: RecipeInput) => Promise<ActionResult<{ id: number }>>;
};

export type RecipeFormInitial = {
  title: string;
  steps: string[];
  tags: { id: number; name: string }[];
  ingredients: RecipeIngredientView[];
};

function SectionHeading({ title, count }: { title: string; count: string }) {
  return (
    <h2 className="flex items-center justify-between px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
      <span className="font-medium normal-case tracking-normal">{count}</span>
    </h2>
  );
}

/**
 * The lines already on the recipe and the row that adds the next one. A line
 * is fixed once added — to change it, remove it and type it again — which
 * keeps every rule about a line (recipe-form-lines.ts) at the one moment it
 * is entered.
 */
function IngredientsSection({
  lines,
  onChange,
  ingredientNames,
  disabled,
}: {
  lines: RecipeIngredientView[];
  onChange: (next: RecipeIngredientView[]) => void;
  ingredientNames: IngredientName[];
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<IngredientDraft>(emptyDraft);
  const [error, setError] = useState<DraftError | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const add = () => {
    const result = parseDraft(draft, lines);
    if (!result.ok) {
      setError(result.error);
      (result.error.field === "quantity" ? quantityRef : nameRef).current?.focus();
      return;
    }
    onChange([...lines, result.line]);
    setDraft(emptyDraft());
    setError(null);
    quantityRef.current?.focus();
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  const edit = (field: keyof IngredientDraft) => (value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  return (
    <section className="space-y-2">
      <SectionHeading title="Ingrediënten" count={String(lines.length)} />
      {lines.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {lines.map((line) => (
            <li key={line.name} className="flex min-h-12 items-center gap-2.5 py-1 pl-3.5 pr-2">
              <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {formatQuantity(line.quantity, line.unit)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] first-letter:uppercase">
                {line.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(lines.filter((l) => l !== line))}
                disabled={disabled}
                aria-label={`${line.name} verwijderen`}
                className="h-9 w-9 text-gray-400 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <Input
          ref={quantityRef}
          value={draft.quantity}
          onChange={(e) => edit("quantity")(e.target.value)}
          onKeyDown={onEnter}
          inputMode="decimal"
          maxLength={8}
          disabled={disabled}
          placeholder="1"
          aria-label="Aantal"
          aria-invalid={error?.field === "quantity"}
          className="h-12 w-14 shrink-0 px-1 text-center"
        />
        <Input
          value={draft.unit}
          onChange={(e) => edit("unit")(e.target.value)}
          onKeyDown={onEnter}
          maxLength={12}
          disabled={disabled}
          placeholder="eenheid"
          aria-label="Eenheid"
          className="h-12 w-[92px] shrink-0 px-2.5"
        />
        <IngredientNameInput
          value={draft.name}
          onChange={edit("name")}
          onEnter={add}
          ingredientNames={ingredientNames}
          inputRef={nameRef}
          disabled={disabled}
          invalid={error?.field === "name"}
        />
        <Button
          type="button"
          size="icon"
          onClick={add}
          disabled={disabled}
          aria-label="Ingrediënt toevoegen"
          className="h-12 w-12 shrink-0"
        >
          <Plus />
        </Button>
      </div>
      {error ? (
        <p className="px-0.5 text-xs text-destructive">{error.message}</p>
      ) : (
        <p className="flex gap-1.5 px-0.5 text-xs text-muted-foreground">
          <span className="w-14 text-center">aantal</span>
          <span className="w-[92px] text-center">eenheid</span>
          <span>ingrediënt</span>
        </p>
      )}
    </section>
  );
}

export default function RecipeForm({
  pageTitle,
  initial,
  existingTags,
  ingredientNames,
  onSubmit,
}: {
  pageTitle: string;
  initial?: RecipeFormInitial;
  existingTags: RecipeTagView[];
  ingredientNames: IngredientName[];
} & RecipeFormActions) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(() => initial?.tags.map((tag) => tag.name) ?? []);
  const [lines, setLines] = useState<RecipeIngredientView[]>(initial?.ingredients ?? []);
  const [steps, setSteps] = useState<string[]>(() => withTrailingBlank(initial?.steps ?? []));

  const save = async () => {
    const validated = recipeSchema.safeParse({ title, steps, ingredients: lines, tags });
    if (!validated.success) {
      const issue = validated.error.errors[0];
      // A bad title is shown under its field; anything else reads as a toast,
      // since there is no field on screen for it to sit under (an empty
      // ingredient list, an over-long step).
      if (issue.path[0] === "title") setTitleError(issue.message);
      else toast.error(issue.message);
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSubmit(validated.data);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      router.push(`/recepten/${result.value.id}`);
    } catch (error) {
      console.error("Failed to save recipe:", error);
      toast.error("Opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title={pageTitle}
        left={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Annuleren"
            disabled={isSaving}
            onClick={() => router.back()}
            className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>
        }
        right={
          <Button
            type="button"
            variant="ghost"
            onClick={save}
            disabled={isSaving}
            className="h-10 shrink-0 px-2 text-[15px] text-primary-foreground hover:bg-white/10 active:bg-white/20"
          >
            {isSaving ? "Bezig…" : "Bewaar"}
          </Button>
        }
        // Wide enough for the word, so the title stays centred against the ×.
        rightWidth="wide"
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <div>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(null);
              }}
              maxLength={80}
              disabled={isSaving}
              placeholder="Naam van het gerecht"
              aria-label="Titel"
              aria-invalid={titleError !== null}
              className="w-full border-b-[1.5px] border-border bg-transparent px-0.5 pb-2 pt-1 text-2xl font-bold outline-none placeholder:text-gray-400 focus:border-primary"
            />
            {titleError && <p className="mt-1 text-xs text-destructive">{titleError}</p>}
          </div>
          <TagPicker
            existingTags={existingTags}
            selected={tags}
            onChange={setTags}
            disabled={isSaving}
          />
        </div>

        <IngredientsSection
          lines={lines}
          onChange={setLines}
          ingredientNames={ingredientNames}
          disabled={isSaving}
        />

        <section className="space-y-2">
          <SectionHeading
            title="Bereiding"
            count={`${steps.length - 1} ${steps.length - 1 === 1 ? "stap" : "stappen"}`}
          />
          <StepEditor steps={steps} onChange={setSteps} disabled={isSaving} />
          <p className="px-0.5 text-xs text-muted-foreground">
            Enter maakt een nieuwe stap. Laat de laatste leeg als je klaar bent.
          </p>
        </section>
      </main>
    </div>
  );
}
