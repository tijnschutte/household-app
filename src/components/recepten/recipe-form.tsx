"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { recipeSchema, type RecipeInput } from "@/src/lib/recepten/schema";
import { parseQuantity } from "@/src/lib/recepten/quantity-input";
import type { IngredientName, RecipeTagView } from "@/src/lib/recepten/view";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * What this form can do, owned here rather than imported from the action
 * module: the server page passes createRecipe/updateRecipe in (already
 * translated to this shape), and a test passes a fake. Keeps Prisma out of
 * anything that renders this.
 *
 * Deleting lives on this page and not on the recipe itself: it is rare and
 * destructive, so it sits with the other management, not under the text
 * someone reads while cooking. Only the edit page passes it.
 */
export type RecipeFormActions = {
  onSubmit: (input: RecipeInput) => Promise<ActionResult<{ id: number }>>;
  onDelete?: () => Promise<void>;
};

export type RecipeFormInitial = {
  title: string;
  instructions: string;
  tags: { id: number; name: string }[];
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
};

type IngredientFormLine = { name: string; quantity: string; unit: string };
type RecipeFormValues = {
  title: string;
  instructions: string;
  ingredients: IngredientFormLine[];
};

function emptyLine(): IngredientFormLine {
  return { name: "", quantity: "", unit: "" };
}

function IngredientRow({
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

export default function RecipeForm({
  pageTitle,
  initial,
  existingTags,
  ingredientNames,
  onSubmit,
  onDelete,
}: {
  pageTitle: string;
  initial?: RecipeFormInitial;
  existingTags: RecipeTagView[];
  ingredientNames: IngredientName[];
} & RecipeFormActions) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      router.push("/recepten");
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      setIsDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initial?.tags.map((t) => t.name) ?? []
  );
  const [tagOptions, setTagOptions] = useState<string[]>(existingTags.map((t) => t.name));
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<RecipeFormValues>({
    defaultValues: {
      title: initial?.title ?? "",
      instructions: initial?.instructions ?? "",
      ingredients:
        initial && initial.ingredients.length > 0
          ? initial.ingredients.map((line) => ({
              name: line.name,
              quantity: line.quantity === null ? "" : String(line.quantity).replace(".", ","),
              unit: line.unit ?? "",
            }))
          : [emptyLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "ingredients" });

  const toggleTag = (name: string) => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const addNewTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setTagOptions((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelectedTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewTagName("");
    setNewTagOpen(false);
  };

  const onValid = async (values: RecipeFormValues) => {
    clearErrors();

    // Client-side, row-by-row: an unparseable quantity or a name repeated
    // from an earlier row is marked on that row and blocks the save, rather
    // than surfacing as the schema's own error on a field the user can't see
    // (B1, B3). Only rows with a name typed in count — an untouched blank
    // row is dropped below, same as before.
    const activeLines = values.ingredients
      .map((line, index) => ({ ...line, index }))
      .filter((line) => line.name.trim() !== "");

    const seenNames = new Set<string>();
    const parsedIngredients: { name: string; quantity: number | null; unit: string | null }[] = [];
    let hasFieldError = false;

    for (const line of activeLines) {
      const parsedQuantity = parseQuantity(line.quantity);
      if (!parsedQuantity.ok) {
        setError(`ingredients.${line.index}.quantity`, {
          type: "manual",
          message: "Hoeveelheid moet een getal zijn",
        });
        hasFieldError = true;
      }

      const normalizedName = line.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        setError(`ingredients.${line.index}.name`, {
          type: "manual",
          message: "Staat al in dit recept",
        });
        hasFieldError = true;
      }
      seenNames.add(normalizedName);

      parsedIngredients.push({
        name: line.name,
        quantity: parsedQuantity.ok ? parsedQuantity.value : null,
        unit: line.unit.trim() === "" ? null : line.unit,
      });
    }

    if (hasFieldError) return;

    const draft = {
      title: values.title,
      instructions: values.instructions,
      ingredients: parsedIngredients,
      tags: selectedTags,
    };

    const validated = recipeSchema.safeParse(draft);
    if (!validated.success) {
      const issue = validated.error.errors[0];
      // A title that's too long (B2) is shown under the field it belongs to,
      // same as the two row-level errors above; anything else still reads
      // as a toast, since there is no other field on screen for it to sit
      // under (an empty ingredient list, an over-long instructions field).
      if (issue.path[0] === "title") {
        setError("title", { type: "manual", message: issue.message });
      } else {
        toast.error(issue.message);
      }
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

  const ingredientErrors = errors.ingredients as FieldErrors<IngredientFormLine>[] | undefined;

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title={pageTitle} left={<BackButton />} />
      <form
        onSubmit={handleSubmit(onValid)}
        className="mx-auto w-full max-w-2xl flex-1 space-y-6 overflow-y-auto px-4 py-4"
      >
        <div className="space-y-2">
          <Label htmlFor="recipe-title">Titel</Label>
          <Input
            id="recipe-title"
            disabled={isSaving}
            aria-invalid={!!errors.title}
            {...register("title")}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Categorieën</Label>
          <div className="flex flex-wrap items-center gap-2">
            {tagOptions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleTag(name)}
                disabled={isSaving}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedTags.includes(name)
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
                      addNewTag();
                    }
                  }}
                  placeholder="Nieuwe categorie"
                  maxLength={30}
                  className="h-8 w-32 rounded-full text-sm"
                />
                <Button type="button" size="sm" onClick={addNewTag} disabled={isSaving}>
                  Toevoegen
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNewTagOpen(true)}
                disabled={isSaving}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
              >
                + nieuw
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ingrediënten</Label>
          {/* Column labels, not placeholders: a placeholder ("hoev.", "eenh.")
              disappears the moment someone types and clips at 390px width
              before that (B5). */}
          <div className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-muted-foreground">
            <span className="min-w-0 flex-1">Ingrediënt</span>
            <span className="w-16 shrink-0">Aantal</span>
            <span className="w-16 shrink-0">Eenheid</span>
            <span className="h-9 w-9 shrink-0" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <IngredientRow
                key={field.id}
                index={index}
                control={control}
                register={register}
                ingredientNames={ingredientNames}
                nameError={ingredientErrors?.[index]?.name?.message}
                quantityError={ingredientErrors?.[index]?.quantity?.message}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
                disabled={isSaving}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => append(emptyLine())}
            disabled={isSaving}
            className="h-10 w-full justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-normal text-muted-foreground"
          >
            <Plus className="h-4 w-4" data-icon="inline-start" />
            Ingrediënt
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-instructions">Bereiding</Label>
          <Textarea
            id="recipe-instructions"
            rows={8}
            maxLength={5000}
            disabled={isSaving}
            {...register("instructions")}
          />
        </div>

        <Button type="submit" disabled={isSaving} className="w-full">
          {isSaving ? "Opslaan..." : "Opslaan"}
        </Button>

        {onDelete && (
          <div className="flex justify-center pt-8">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={isSaving}
              className="h-9 px-2 text-sm font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Recept verwijderen
            </Button>
          </div>
        )}
      </form>

      {onDelete && (
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={(next) => !isDeleting && setConfirmDeleteOpen(next)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{initial?.title ?? "Recept"} verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Bezig..." : "Verwijderen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
