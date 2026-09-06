import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeDetailClient from "./recipe-detail-client";
import type { RecipeDetail } from "@/src/lib/recepten/view";
import type { RecipeForSuggestion } from "@/src/lib/recepten/suggestions";

function aRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    title: "Pasta pesto",
    instructions: "Kook de pasta.\n\nMeng met pesto.",
    tags: [{ id: 1, name: "Snel" }],
    ingredients: [
      { name: "pasta", quantity: 200, unit: "gram" },
      { name: "pesto", quantity: null, unit: null },
    ],
    onList: false,
    ...overrides,
  };
}

function fakeActions(suggestions: RecipeForSuggestion[] = []) {
  const addedToBasket: number[] = [];
  const suggestionsRequestedFor: number[] = [];
  let addRejects = false;

  return {
    addedToBasket,
    suggestionsRequestedFor,
    rejectAdd() {
      addRejects = true;
    },
    onAddToBasket: async (recipeId: number) => {
      if (addRejects) throw new Error("mislukt");
      addedToBasket.push(recipeId);
    },
    onLoadSuggestions: async (recipeId: number) => {
      suggestionsRequestedFor.push(recipeId);
      return suggestions;
    },
  };
}

function renderDetail(recipe = aRecipe(), fake = fakeActions()) {
  render(
    <RecipeDetailClient
      recipe={recipe}
      onAddToBasket={fake.onAddToBasket}
      onLoadSuggestions={fake.onLoadSuggestions}
    />
  );
  return fake;
}

describe("RecipeDetailClient", () => {
  it("shows the ingredients segment by default, quantity and unit included", () => {
    renderDetail();

    expect(screen.getByText("pasta")).toBeInTheDocument();
    expect(screen.getByText("200 gram")).toBeInTheDocument();
    expect(screen.getByText("pesto")).toBeInTheDocument();
  });

  it("switches to the recept segment without navigating", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("tab", { name: "Recept" }));

    expect(screen.getByText("Kook de pasta.")).toBeInTheDocument();
    expect(screen.getByText("Meng met pesto.")).toBeInTheDocument();
    expect(screen.queryByText("pasta")).not.toBeInTheDocument();
  });

  describe("adding to the basket (D2)", () => {
    it("adds the recipe to the basket, shows a confirmation, then reads 'Al in mandje'", async () => {
      vi.useFakeTimers();
      try {
        const fake = renderDetail(aRecipe({ id: 42, onList: false }));
        const button = screen.getByRole("button", { name: /in mandje/i });

        // fireEvent rather than userEvent: userEvent's own internal waiting
        // does not mix reliably with fake timers, and a plain click event
        // needs none of its pointer-sequence simulation.
        await act(async () => {
          fireEvent.click(button);
          await Promise.resolve(); // let the resolved onAddToBasket promise settle
        });

        expect(fake.addedToBasket).toEqual([42]);
        expect(screen.getByText("In mandje")).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(2000);
        });
        expect(button).toBeEnabled();
        expect(screen.getByText("Al in mandje")).toBeInTheDocument();
      } finally {
        // Always restored, even if an assertion above throws — otherwise a
        // failure here would leave every later test in this file waiting on a
        // clock nothing advances.
        vi.useRealTimers();
      }
    });

    it("disables the basket button while the add is pending", async () => {
      const user = userEvent.setup();
      let resolveAdd: () => void = () => {};
      const pending = new Promise<void>((resolve) => {
        resolveAdd = resolve;
      });
      const fake = fakeActions();
      fake.onAddToBasket = async () => {
        await pending;
        fake.addedToBasket.push(1);
      };
      renderDetail(aRecipe(), fake);

      const button = screen.getByRole("button", { name: /in mandje/i });
      await user.click(button);

      expect(button).toBeDisabled();

      resolveAdd();
      await waitFor(() => expect(button).toBeEnabled());
    });

    it("reads 'Al in mandje' straight away when the server already says onList", () => {
      renderDetail(aRecipe({ onList: true }));

      expect(screen.getByRole("button", { name: "Al in mandje" })).toBeInTheDocument();
    });

    it("asks for confirmation before adding again when already on the list", async () => {
      const user = userEvent.setup();
      const fake = renderDetail(aRecipe({ id: 7, onList: true }));

      await user.click(screen.getByRole("button", { name: "Al in mandje" }));

      expect(screen.getByText("Nog een keer toevoegen?")).toBeInTheDocument();
      expect(fake.addedToBasket).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Toevoegen" }));
      expect(fake.addedToBasket).toEqual([7]);
    });

    it("cancelling the confirmation adds nothing", async () => {
      const user = userEvent.setup();
      const fake = renderDetail(aRecipe({ onList: true }));

      await user.click(screen.getByRole("button", { name: "Al in mandje" }));
      await user.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(fake.addedToBasket).toEqual([]);
    });
  });

  describe("shared ingredients", () => {
    it("loads and lists recipes sharing an ingredient, with a link to each", async () => {
      const user = userEvent.setup();
      const fake = fakeActions([{ id: 2, title: "Tomatensoep", ingredientNames: ["pasta", "ui"] }]);
      renderDetail(aRecipe(), fake);

      await user.click(
        screen.getByRole("button", { name: "Deelt ingrediënten met andere recepten" })
      );

      expect(fake.suggestionsRequestedFor).toEqual([1]);
      expect(await screen.findByText("Tomatensoep")).toBeInTheDocument();
      expect(screen.getByText("deelt: pasta")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Bekijken/ })).toHaveAttribute("href", "/recepten/2");
    });

    it("shows the empty state when nothing shares an ingredient", async () => {
      const user = userEvent.setup();
      renderDetail(aRecipe(), fakeActions([]));

      await user.click(
        screen.getByRole("button", { name: "Deelt ingrediënten met andere recepten" })
      );

      expect(
        await screen.findByText("Nog geen recept dat ingrediënten deelt met dit recept")
      ).toBeInTheDocument();
    });
  });
});
