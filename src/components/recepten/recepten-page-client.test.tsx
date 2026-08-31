import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceptenPageClient from "./recepten-page-client";
import type { RecipeSummary, RecipeTagView } from "@/src/lib/recepten/view";

function aRecipe(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return { id: 1, title: "Pasta pesto", tags: [], ...overrides };
}

const snel: RecipeTagView = { id: 1, name: "Snel" };

describe("ReceptenPageClient", () => {
  describe("the category filter's clear button (D5)", () => {
    it("is absent while nothing is selected", () => {
      render(<ReceptenPageClient recipes={[aRecipe()]} tags={[snel]} />);

      expect(screen.queryByRole("button", { name: "Filter wissen" })).not.toBeInTheDocument();
    });

    it("appears once a category is selected, and clears the selection without opening the menu", async () => {
      const user = userEvent.setup();
      const tagged = aRecipe({ id: 1, title: "Snelle pasta", tags: [snel] });
      const untagged = aRecipe({ id: 2, title: "Stoofpot", tags: [] });
      render(<ReceptenPageClient recipes={[tagged, untagged]} tags={[snel]} />);

      await user.click(screen.getByRole("button", { name: "Filter op categorie" }));
      await user.click(screen.getByRole("menuitemcheckbox", { name: "Snel" }));
      // The × sits beside the trigger, not inside the open menu's portal —
      // close the menu first, the way it's actually encountered browsing.
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Filter wissen" })).toBeInTheDocument();
      expect(screen.queryByText("Stoofpot")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Filter wissen" }));

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Filter wissen" })).not.toBeInTheDocument();
      expect(screen.getByText("Stoofpot")).toBeInTheDocument();
    });
  });

  it("shows a muted note inside the menu explaining several categories narrow together", async () => {
    const user = userEvent.setup();
    render(<ReceptenPageClient recipes={[aRecipe()]} tags={[snel]} />);

    await user.click(screen.getByRole("button", { name: "Filter op categorie" }));

    expect(screen.getByText("Toont recepten met álle gekozen categorieën")).toBeInTheDocument();
  });
});
