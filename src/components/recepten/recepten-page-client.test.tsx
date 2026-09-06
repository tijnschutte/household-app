import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReceptenPageClient from "./recepten-page-client";
import type { RecipeSummary, RecipeTagView } from "@/src/lib/recepten/view";

function aRecipe(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 1,
    title: "Pasta pesto",
    tags: [],
    ingredientNames: ["pasta", "pesto"],
    stepCount: 3,
    onList: false,
    ...overrides,
  };
}

const snel: RecipeTagView = { id: 1, name: "Snel" };
const vega: RecipeTagView = { id: 2, name: "Vega" };

describe("ReceptenPageClient", () => {
  it("lists every recipe with its counts and a link to it", () => {
    render(<ReceptenPageClient recipes={[aRecipe()]} tags={[]} />);

    expect(screen.getByRole("link", { name: /Pasta pesto/ })).toHaveAttribute(
      "href",
      "/recepten/1"
    );
    expect(screen.getByText("2 ingrediënten · 3 stappen")).toBeInTheDocument();
  });

  it("marks a recipe whose ingredients are all on the list", () => {
    render(<ReceptenPageClient recipes={[aRecipe({ onList: true })]} tags={[]} />);

    expect(screen.getByText("In mandje ·")).toBeInTheDocument();
  });

  it("finds a recipe by an ingredient as well as by title", async () => {
    const user = userEvent.setup();
    const caprese = aRecipe({ id: 1, title: "Caprese", ingredientNames: ["basilicum"] });
    const soep = aRecipe({ id: 2, title: "Tomatensoep", ingredientNames: ["ui"] });
    render(<ReceptenPageClient recipes={[caprese, soep]} tags={[]} />);

    await user.type(screen.getByRole("textbox", { name: "Zoek op naam of ingrediënt" }), "basil");

    expect(screen.getByText("Caprese")).toBeInTheDocument();
    expect(screen.queryByText("Tomatensoep")).not.toBeInTheDocument();
  });

  it("narrows by tag chips, several together, and 'Alles' clears them", async () => {
    const user = userEvent.setup();
    const both = aRecipe({ id: 1, title: "Snelle vega", tags: [snel, vega] });
    const onlySnel = aRecipe({ id: 2, title: "Snelle kip", tags: [snel] });
    const neither = aRecipe({ id: 3, title: "Stoofpot", tags: [] });
    render(<ReceptenPageClient recipes={[both, onlySnel, neither]} tags={[snel, vega]} />);

    await user.click(screen.getByRole("button", { name: "Snel" }));
    expect(screen.queryByText("Stoofpot")).not.toBeInTheDocument();
    expect(screen.getByText("Snelle kip")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vega" }));
    expect(screen.queryByText("Snelle kip")).not.toBeInTheDocument();
    expect(screen.getByText("Snelle vega")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Alles" }));
    expect(screen.getByText("Stoofpot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alles" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tells a household without recipes where the + is", () => {
    render(<ReceptenPageClient recipes={[]} tags={[]} />);

    expect(screen.getByText("Nog geen recepten")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nieuw recept" })).toHaveAttribute(
      "href",
      "/recepten/nieuw"
    );
  });
});
