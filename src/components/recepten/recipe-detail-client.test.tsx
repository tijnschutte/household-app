import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipeDetailClient from "./recipe-detail-client";
import type { RecipeDetail } from "@/src/lib/recepten/view";

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
    ...overrides,
  };
}

function fakeActions() {
  const addedToBasket: number[] = [];
  let addRejects = false;

  return {
    addedToBasket,
    rejectAdd() {
      addRejects = true;
    },
    onAddToBasket: async (recipeId: number) => {
      if (addRejects) throw new Error("mislukt");
      addedToBasket.push(recipeId);
    },
  };
}

function renderDetail(recipe = aRecipe(), fake = fakeActions()) {
  render(<RecipeDetailClient recipe={recipe} onAddToBasket={fake.onAddToBasket} />);
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

  it("adds the recipe to the basket, shows a confirmation, then returns to normal", async () => {
    vi.useFakeTimers();
    try {
      const fake = renderDetail(aRecipe({ id: 42 }));
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
  });
});
