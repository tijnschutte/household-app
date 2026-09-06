"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Check, MoreHorizontal, Pencil, Shuffle, ShoppingBasket, Trash2 } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import BackButton from "@/src/components/back-button";
import { Button } from "@/src/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import BasketSheet from "@/src/components/recepten/basket-sheet";
import { formatQuantity } from "@/src/lib/quantity";
import { allOnList } from "@/src/lib/recepten/basket";
import type { RecipeDetail } from "@/src/lib/recepten/view";

type Segment = "ingredienten" | "bereiding";

export type RecipeDetailActions = {
  /** Puts the named ingredients on the shared list; rejects when it could not. */
  onAddToBasket: (recipeId: number, ingredientNames: string[]) => Promise<void>;
  onDelete: (recipeId: number) => Promise<void>;
};

/** Left: the ingredients. Right: the method. The same sliding pill as the Mandje's list toggle. */
function SegmentedControl({
  segment,
  onChange,
}: {
  segment: Segment;
  onChange: (s: Segment) => void;
}) {
  const isBereiding = segment === "bereiding";
  const tab = (key: Segment, label: string) => {
    const on = segment === key;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => onChange(key)}
        className={`relative z-10 h-10 flex-1 rounded-md text-sm font-medium transition-colors ${
          on ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      role="tablist"
      aria-label="Onderdeel"
      className="relative flex w-full rounded-lg bg-secondary p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: isBereiding ? "translateX(100%)" : "translateX(0)" }}
      />
      {tab("ingredienten", "Ingrediënten")}
      {tab("bereiding", "Bereiding")}
    </div>
  );
}

function Ingredients({ recipe }: { recipe: RecipeDetail }) {
  const unbought = new Set(recipe.listRows.flatMap((row) => (row.bought ? [] : [row.name])));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {recipe.ingredients.map((line) => (
        <li key={line.name} className="flex min-h-12 items-center gap-2.5 px-3.5 py-2.5">
          <span className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {formatQuantity(line.quantity, line.unit)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] first-letter:uppercase">
            {line.name}
          </span>
          {unbought.has(line.name) && (
            <span className="shrink-0 text-xs text-primary">in mandje</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The method, one step per row. A tap ticks a step off, so a cook can find their place again. */
function Steps({ steps }: { steps: string[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());

  if (steps.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Nog geen bereiding.</p>;
  }

  const toggle = (index: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  // Two steps may read the same, so the text alone is not a key; its
  // occurrence count makes it one.
  const seen = new Map<string, number>();
  const keyFor = (step: string) => {
    const n = (seen.get(step) ?? 0) + 1;
    seen.set(step, n);
    return `${step}#${n}`;
  };

  return (
    <div className="space-y-3">
      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {steps.map((step, index) => {
          const isDone = done.has(index);
          return (
            <li key={keyFor(step)}>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => toggle(index)}
                className="flex w-full items-start gap-3.5 px-3.5 py-3.5 text-left"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                    isDone ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <p className={`pt-0.5 text-base leading-relaxed ${isDone ? "text-gray-400" : ""}`}>
                  {step}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-center text-xs text-muted-foreground">
        Tik een stap aan om hem af te vinken
      </p>
    </div>
  );
}

export default function RecipeDetailClient({
  recipe,
  onAddToBasket,
  onDelete,
}: { recipe: RecipeDetail } & RecipeDetailActions) {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("ingredienten");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Stays true after a successful delete: the screen is navigating away, and
  // the button must not re-arm in the gap.
  const [deleted, setDeleted] = useState(false);

  const onList = allOnList(
    recipe.ingredients.map((line) => line.name),
    recipe.listRows
  );

  const addToBasket = async (names: string[]) => {
    try {
      await onAddToBasket(recipe.id, names);
    } catch (error) {
      console.error("Failed to add recipe to basket:", error);
      toast.error("Toevoegen mislukt");
      return false;
    }
    toast.success(
      names.length === 1 ? "1 item in je mandje" : `${names.length} items in je mandje`
    );
    // The server knows the list's new state; re-render from it rather than
    // guessing which rows changed.
    router.refresh();
    return true;
  };

  const deleteRecipe = async () => {
    setIsDeleting(true);
    try {
      await onDelete(recipe.id);
      setDeleted(true);
      router.push("/recepten");
    } catch (error) {
      console.error("Failed to delete recipe:", error);
      toast.error("Verwijderen mislukt");
      setConfirmDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader
        title="Recepten"
        left={<BackButton />}
        right={
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Meer"
                className="shrink-0 text-primary-foreground hover:bg-white/10 active:bg-white/20"
              >
                <MoreHorizontal className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1.5">
              <DropdownMenuItem asChild className="rounded-lg py-2.5">
                <Link href={`/recepten/${recipe.id}/bewerken`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bewerken
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setConfirmDeleteOpen(true)}
                className="rounded-lg py-2.5 text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight first-letter:uppercase">
            {recipe.title}
          </h1>
          {recipe.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <SegmentedControl segment={segment} onChange={setSegment} />

        {segment === "ingredienten" ? (
          <Ingredients recipe={recipe} />
        ) : (
          <Steps steps={recipe.steps} />
        )}
      </main>

      <footer className="w-full shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl gap-2.5">
          <Button asChild variant="outline" className="h-12 shrink-0 gap-2 px-4 text-[15px]">
            <Link href={`/recepten/${recipe.id}/lijkt-op`}>
              <Shuffle className="h-5 w-5" data-icon="inline-start" />
              Lijkt op
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => setSheetOpen(true)}
            variant={onList ? "secondary" : "default"}
            className="h-12 flex-1 gap-2 text-[15px]"
          >
            {onList ? (
              <>
                <Check className="h-5 w-5" data-icon="inline-start" />
                Op de lijst
              </>
            ) : (
              <>
                <ShoppingBasket className="h-5 w-5" data-icon="inline-start" />
                In mandje
              </>
            )}
          </Button>
        </div>
      </footer>

      <BasketSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        ingredients={recipe.ingredients}
        listRows={recipe.listRows}
        onConfirm={addToBasket}
      />

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(next) => !isDeleting && !deleted && setConfirmDeleteOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{recipe.title} verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting || deleted}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRecipe}
              disabled={isDeleting || deleted}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting || deleted ? "Bezig..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
