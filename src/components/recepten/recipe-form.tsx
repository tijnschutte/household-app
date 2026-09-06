"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import IngredientRow from "@/src/components/recepten/ingredient-row";
import TagPicker from "@/src/components/recepten/tag-picker";
import DeleteRecipe from "@/src/components/recepten/delete-recipe";
import { recipeSchema, type RecipeInput } from "@/src/lib/recepten/schema";
import {
  emptyLine,
  parseIngredientLines,
  toFormLines,
  type IngredientFormLine,
  type RecipeFormValues,
} from "@/src/lib/recepten/recipe-form-lines";
import type { IngredientName, RecipeTagView } from "@/src/lib/recepten/view";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * What this form can do, owned here rather than imported from the action
 * module: the server page passes createRecipe/updateRecipe in (already
 * translated to this shape), and a test passes a fake. Keeps Prisma out of
 * anything that renders this. Only the edit page passes onDelete.
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
  const [selectedTags, setSelectedTags] = useState<string[]>(
    () => initial?.tags.map((tag) => tag.name) ?? []
  );

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
      ingredients: toFormLines(initial?.ingredients ?? []),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "ingredients" });

  const onValid = async (values: RecipeFormValues) => {
    clearErrors();

    // Row-level errors are pinned to the row they belong to and block the
    // save, rather than surfacing as the schema's own error on a field the
    // user can't see (B1, B3).
    const lines = parseIngredientLines(values.ingredients);
    for (const lineError of lines.errors) {
      setError(`ingredients.${lineError.index}.${lineError.field}`, {
        type: "manual",
        message: lineError.message,
      });
    }
    if (lines.errors.length > 0) return;

    const validated = recipeSchema.safeParse({
      title: values.title,
      instructions: values.instructions,
      ingredients: lines.ingredients,
      tags: selectedTags,
    });
    if (!validated.success) {
      const issue = validated.error.errors[0];
      // A title that's too long (B2) is shown under its field, like the row
      // errors above; anything else still reads as a toast, since there is no
      // other field on screen for it to sit under (an empty ingredient list,
      // an over-long instructions field).
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
          <TagPicker
            existingTags={existingTags}
            selected={selectedTags}
            onChange={setSelectedTags}
            disabled={isSaving}
          />
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
          <DeleteRecipe
            title={initial?.title ?? "Recept"}
            onDelete={onDelete}
            disabled={isSaving}
          />
        )}
      </form>
    </div>
  );
}
