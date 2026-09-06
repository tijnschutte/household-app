import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SimilarRecipesClient from "./similar-recipes-client";
import type { RecipeForSimilarity } from "@/src/lib/recepten/view";

const pesto: RecipeForSimilarity = {
  id: 1,
  title: "Pasta pesto",
  ingredientNames: ["pasta", "pesto", "basilicum"],
};

describe("SimilarRecipesClient", () => {
  it("ranks the others by shared ingredients and shows shared, missing and the tally", () => {
    const caprese: RecipeForSimilarity = {
      id: 2,
      title: "Caprese",
      ingredientNames: ["basilicum", "mozzarella"],
    };
    const soep: RecipeForSimilarity = {
      id: 3,
      title: "Tomatensoep",
      ingredientNames: ["pasta", "basilicum", "ui"],
    };
    render(<SimilarRecipesClient recipe={pesto} others={[caprese, soep]} />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/recepten/3", "/recepten/2"]);
    expect(links[0]).toHaveTextContent("2 van 3 gedeeld");
    expect(links[0]).toHaveTextContent("Nog 1 nodig");
    expect(links[1]).toHaveTextContent("1 van 2 gedeeld");
  });

  it("narrows to recipes using one ingredient when its chip is tapped, and back again", async () => {
    const user = userEvent.setup();
    const withPasta: RecipeForSimilarity = { id: 2, title: "Lasagne", ingredientNames: ["pasta"] };
    const withPesto: RecipeForSimilarity = {
      id: 3,
      title: "Pesto kip",
      ingredientNames: ["pesto"],
    };
    render(<SimilarRecipesClient recipe={pesto} others={[withPasta, withPesto]} />);

    await user.click(screen.getByRole("button", { name: "pesto" }));
    expect(screen.getByText("Pesto kip")).toBeInTheDocument();
    expect(screen.queryByText("Lasagne")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Alle ingrediënten" }));
    expect(screen.getByText("Lasagne")).toBeInTheDocument();
  });

  it("says so when nothing shares an ingredient", () => {
    render(<SimilarRecipesClient recipe={pesto} others={[]} />);

    expect(
      screen.getByText("Nog geen recept dat ingrediënten deelt met dit recept")
    ).toBeInTheDocument();
  });
});
