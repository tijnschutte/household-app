import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { useRouter } from "next/navigation";
import RecipeForm from "./recipe-form";
import { succeeds, fails } from "@/tests/fixtures/household";
import type { RecipeInput } from "@/src/lib/recepten/schema";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * A stand-in for createRecipe/updateRecipe. It records the exact input the
 * form handed it — after the form's own normalisation — so a test can check
 * what actually crosses the boundary, not just what the user typed.
 */
function fakeSubmit(
  result: ActionResult<{ id: number }> = succeeds("Recept aangemaakt", { id: 7 })
) {
  const calls: RecipeInput[] = [];
  return {
    calls,
    onSubmit: async (input: RecipeInput) => {
      calls.push(input);
      return result;
    },
  };
}

function renderForm(submit = fakeSubmit(), ingredientNames: { id: number; name: string }[] = []) {
  render(
    <>
      <RecipeForm
        pageTitle="Nieuw recept"
        existingTags={[]}
        ingredientNames={ingredientNames}
        onSubmit={submit.onSubmit}
      />
      <Toaster />
    </>
  );
  return submit;
}

async function addIngredient(name: string, quantity = "", unit = "") {
  const user = userEvent.setup();
  if (quantity) await user.type(screen.getByLabelText("Aantal"), quantity);
  if (unit) await user.type(screen.getByLabelText("Eenheid"), unit);
  await user.type(screen.getByLabelText("Ingrediënt"), name);
  await user.click(screen.getByRole("button", { name: "Ingrediënt toevoegen" }));
}

describe("RecipeForm", () => {
  it("submits a normalised recipe and navigates to it", async () => {
    const user = userEvent.setup();
    const submit = renderForm();

    await user.type(screen.getByLabelText("Titel"), "Pasta pesto");
    await addIngredient("Ui", "2", "STUK");
    await addIngredient("Kaas");
    await user.type(screen.getByLabelText("Stap 1"), "Snijd de ui.{Enter}Rasp de kaas.");
    await user.click(screen.getByRole("button", { name: "Bewaar" }));

    await waitFor(() => expect(submit.calls).toHaveLength(1));
    expect(submit.calls[0]).toEqual({
      title: "Pasta pesto",
      steps: ["Snijd de ui.", "Rasp de kaas."],
      ingredients: [
        { name: "ui", quantity: 2, unit: "stuks" },
        { name: "kaas", quantity: null, unit: null },
      ],
      tags: [],
    });
    expect(useRouter().push).toHaveBeenCalledWith("/recepten/7");
  });

  it("shows an added line with its quantity and clears the entry row for the next", async () => {
    renderForm();

    await addIngredient("pasta", "300", "g");

    expect(screen.getByText("pasta")).toBeInTheDocument();
    expect(screen.getByText("300 g")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediënt")).toHaveValue("");
    expect(screen.getByLabelText("Aantal")).toHaveValue("");
  });

  it("adds a line on Enter in the name field", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Ingrediënt"), "pasta{Enter}");

    expect(screen.getByText("pasta")).toBeInTheDocument();
  });

  it("removes a line again", async () => {
    const user = userEvent.setup();
    renderForm();
    await addIngredient("pasta");

    await user.click(screen.getByRole("button", { name: "pasta verwijderen" }));

    expect(screen.queryByText("pasta")).not.toBeInTheDocument();
  });

  it("refuses a line without a name, and a name already on the recipe", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Ingrediënt toevoegen" }));
    expect(screen.getByText("Naam is vereist")).toBeInTheDocument();

    await addIngredient("ui");
    await addIngredient(" UI ");
    expect(screen.getByText("Staat al in dit recept")).toBeInTheDocument();
    expect(screen.getAllByText("ui")).toHaveLength(1);
  });

  it("refuses a quantity that is not a number, and keeps the draft to fix", async () => {
    renderForm();

    await addIngredient("ui", "abc");

    expect(screen.getByText("Hoeveelheid moet een getal zijn")).toBeInTheDocument();
    expect(screen.getByLabelText("Ingrediënt")).toHaveValue("ui");
    expect(screen.queryByRole("button", { name: "ui verwijderen" })).not.toBeInTheDocument();
  });

  it("offers the household's ingredient names while typing, and picking one fills the field", async () => {
    const user = userEvent.setup();
    renderForm(fakeSubmit(), [{ id: 1, name: "pasta" }]);

    await user.type(screen.getByLabelText("Ingrediënt"), "pas");
    await user.click(screen.getByRole("button", { name: "pasta" }));

    expect(screen.getByLabelText("Ingrediënt")).toHaveValue("pasta");
  });

  it("shows a missing title under the field and does not submit", async () => {
    const user = userEvent.setup();
    const submit = renderForm();
    await addIngredient("ui");

    await user.click(screen.getByRole("button", { name: "Bewaar" }));

    expect(screen.getByText("Titel is vereist")).toBeInTheDocument();
    expect(submit.calls).toEqual([]);
  });

  it("toasts the schema's message when there is no ingredient", async () => {
    const user = userEvent.setup();
    const submit = renderForm();
    await user.type(screen.getByLabelText("Titel"), "Leeg");

    await user.click(screen.getByRole("button", { name: "Bewaar" }));

    expect(await screen.findByText("Voeg minstens 1 ingrediënt toe")).toBeInTheDocument();
    expect(submit.calls).toEqual([]);
  });

  it("toasts a failure the action reports and stays on the form", async () => {
    const user = userEvent.setup();
    renderForm(fakeSubmit(fails("Er is al een recept met deze naam")));
    await user.type(screen.getByLabelText("Titel"), "Pasta pesto");
    await addIngredient("ui");

    await user.click(screen.getByRole("button", { name: "Bewaar" }));

    expect(await screen.findByText("Er is al een recept met deze naam")).toBeInTheDocument();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it("prefills an existing recipe and lets its lines be removed", async () => {
    const user = userEvent.setup();
    const submit = fakeSubmit(succeeds("Recept bijgewerkt", { id: 3 }));
    render(
      <RecipeForm
        pageTitle="Recept bewerken"
        initial={{
          title: "Pasta pesto",
          steps: ["Kook de pasta."],
          tags: [{ id: 1, name: "Snel" }],
          ingredients: [
            { name: "pasta", quantity: 200, unit: "g" },
            { name: "zout", quantity: null, unit: null },
          ],
        }}
        existingTags={[{ id: 1, name: "Snel" }]}
        ingredientNames={[]}
        onSubmit={submit.onSubmit}
      />
    );

    expect(screen.getByLabelText("Titel")).toHaveValue("Pasta pesto");
    expect(screen.getByLabelText("Stap 1")).toHaveValue("Kook de pasta.");
    expect(screen.getByRole("button", { name: "Snel" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "zout verwijderen" }));
    await user.click(screen.getByRole("button", { name: "Bewaar" }));

    await waitFor(() => expect(submit.calls).toHaveLength(1));
    expect(submit.calls[0]).toMatchObject({
      ingredients: [{ name: "pasta", quantity: 200, unit: "g" }],
      tags: ["Snel"],
    });
  });

  it("the × in the header goes back without saving", async () => {
    const user = userEvent.setup();
    const submit = renderForm();

    await user.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(useRouter().back).toHaveBeenCalled();
    expect(submit.calls).toEqual([]);
  });
});
