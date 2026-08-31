import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderForm(submit = fakeSubmit()) {
  render(
    <RecipeForm
      pageTitle="Nieuw recept"
      existingTags={[]}
      ingredientNames={[]}
      onSubmit={submit.onSubmit}
    />
  );
  return submit;
}

/** The edit page's shape: prefilled, and able to delete. */
function renderEditForm() {
  const deleted: number[] = [];
  render(
    <RecipeForm
      pageTitle="Recept bewerken"
      initial={{
        title: "Pasta pesto",
        instructions: "",
        tags: [],
        ingredients: [{ name: "ui", quantity: null, unit: null }],
      }}
      existingTags={[]}
      ingredientNames={[]}
      onSubmit={fakeSubmit().onSubmit}
      onDelete={async () => {
        deleted.push(1);
      }}
    />
  );
  return { deleted };
}

async function fillFirstRow(name: string, quantity: string, unit: string) {
  if (name) await userEvent.type(screen.getAllByLabelText("Ingrediëntnaam")[0], name);
  if (quantity) await userEvent.type(screen.getAllByLabelText("Hoeveelheid")[0], quantity);
  if (unit) await userEvent.type(screen.getAllByLabelText("Eenheid")[0], unit);
}

describe("RecipeForm", () => {
  it("submits a normalised recipe after adding a line", async () => {
    const submit = renderForm();

    await userEvent.type(screen.getByLabelText("Titel"), "Pasta pesto");
    await fillFirstRow("Ui", "2", "STUKS");

    await userEvent.click(screen.getByRole("button", { name: "Ingrediënt" }));
    await userEvent.type(screen.getAllByLabelText("Ingrediëntnaam")[1], "Kaas");

    await userEvent.type(screen.getByLabelText("Bereiding"), "Snijd de ui.");
    await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(submit.calls).toEqual([
      {
        title: "Pasta pesto",
        instructions: "Snijd de ui.",
        ingredients: [
          { name: "ui", quantity: 2, unit: "stuks" },
          { name: "kaas", quantity: null, unit: null },
        ],
        tags: [],
      },
    ]);
  });

  it("refuses to submit with no ingredients at all filled in", async () => {
    const submit = renderForm();

    await userEvent.type(screen.getByLabelText("Titel"), "Leeg recept");
    await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(submit.calls).toEqual([]);
  });

  it("removes a line with its own remove button", async () => {
    const submit = renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Ingrediënt" }));
    expect(screen.getAllByLabelText("Ingrediëntnaam")).toHaveLength(2);

    await userEvent.click(screen.getAllByLabelText("Ingrediënt verwijderen")[1]);
    expect(screen.getAllByLabelText("Ingrediëntnaam")).toHaveLength(1);

    await userEvent.type(screen.getByLabelText("Titel"), "Een regel");
    await fillFirstRow("ui", "", "");
    await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(submit.calls).toEqual([
      {
        title: "Een regel",
        instructions: "",
        ingredients: [{ name: "ui", quantity: null, unit: null }],
        tags: [],
      },
    ]);
  });

  it("lets the user try again when the server rejects the title", async () => {
    const submit = fakeSubmit(fails("Er is al een recept met deze naam"));
    renderForm(submit);

    await userEvent.type(screen.getByLabelText("Titel"), "Pasta pesto");
    await fillFirstRow("ui", "", "");
    await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(submit.calls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Opslaan" })).toBeEnabled();
  });

  it("toggles a category chip and adds a new one", async () => {
    const submit = renderForm();
    // No existing tags passed in, so this exercises the "+ nieuw" inline add.
    await userEvent.click(screen.getByRole("button", { name: "+ nieuw" }));
    await userEvent.type(screen.getByPlaceholderText("Nieuwe categorie"), "Snel");
    await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

    await userEvent.type(screen.getByLabelText("Titel"), "Snelle pasta");
    await fillFirstRow("ui", "", "");
    await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(submit.calls[0].tags).toEqual(["Snel"]);
  });

  it("offers no delete when creating a recipe", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "Recept verwijderen" })).not.toBeInTheDocument();
  });

  it("deletes after confirming, and navigates back to the list", async () => {
    const { deleted } = renderEditForm();

    await userEvent.click(screen.getByRole("button", { name: "Recept verwijderen" }));
    await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

    expect(deleted).toEqual([1]);
    expect(useRouter().push).toHaveBeenCalledWith("/recepten");
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const { deleted } = renderEditForm();

    await userEvent.click(screen.getByRole("button", { name: "Recept verwijderen" }));
    await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(deleted).toEqual([]);
  });

  describe("quantity (B1)", () => {
    it("parses a unicode fraction and a mixed number", async () => {
      const submit = renderForm();

      await userEvent.type(screen.getByLabelText("Titel"), "Pasta pesto");
      await userEvent.type(screen.getAllByLabelText("Ingrediëntnaam")[0], "ui");
      await userEvent.type(screen.getAllByLabelText("Hoeveelheid")[0], "1 ½");
      await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

      expect(submit.calls).toEqual([
        {
          title: "Pasta pesto",
          instructions: "",
          ingredients: [{ name: "ui", quantity: 1.5, unit: null }],
          tags: [],
        },
      ]);
    });

    it("marks an unparseable quantity on its own row and blocks the save", async () => {
      const submit = renderForm();

      await userEvent.type(screen.getByLabelText("Titel"), "Pasta pesto");
      await fillFirstRow("ui", "abc", "");
      await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

      expect(screen.getByText("Hoeveelheid moet een getal zijn")).toBeInTheDocument();
      expect(submit.calls).toEqual([]);
    });
  });

  describe("title length (B2)", () => {
    it("accepts typing a title over 80 characters, rather than truncating it", async () => {
      renderForm();
      const longTitle = "a".repeat(90);

      await userEvent.type(screen.getByLabelText("Titel"), longTitle);

      expect(screen.getByLabelText("Titel")).toHaveValue(longTitle);
    });

    it("shows the schema's message under the field and blocks the save", async () => {
      const submit = renderForm();

      await userEvent.type(screen.getByLabelText("Titel"), "a".repeat(90));
      await fillFirstRow("ui", "", "");
      await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

      expect(screen.getByText("Titel mag maximaal 80 tekens zijn")).toBeInTheDocument();
      expect(submit.calls).toEqual([]);
    });
  });

  describe("duplicate ingredient names (B3)", () => {
    it("marks the later row and blocks the save, leaving the first row untouched", async () => {
      const submit = renderForm();

      await userEvent.type(screen.getByLabelText("Titel"), "Pasta pesto");
      await fillFirstRow("ui", "", "");
      await userEvent.click(screen.getByRole("button", { name: "Ingrediënt" }));
      await userEvent.type(screen.getAllByLabelText("Ingrediëntnaam")[1], "UI");
      await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

      expect(screen.getByText("Staat al in dit recept")).toBeInTheDocument();
      expect(submit.calls).toEqual([]);
    });
  });

  describe("ingredient-name autocomplete (B4)", () => {
    const ingredientNames = [{ id: 1, name: "ui" }];

    function renderFormWithIngredients() {
      const submit = fakeSubmit();
      render(
        <RecipeForm
          pageTitle="Nieuw recept"
          existingTags={[]}
          ingredientNames={ingredientNames}
          onSubmit={submit.onSubmit}
        />
      );
      return submit;
    }

    it("closes the suggestions on Escape", async () => {
      renderFormWithIngredients();
      const nameField = screen.getAllByLabelText("Ingrediëntnaam")[0];

      await userEvent.type(nameField, "u");
      expect(screen.getByRole("button", { name: "ui" })).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("button", { name: "ui" })).not.toBeInTheDocument();
    });

    it("closes the suggestions on blur", async () => {
      renderFormWithIngredients();
      const nameField = screen.getAllByLabelText("Ingrediëntnaam")[0];

      await userEvent.type(nameField, "u");
      expect(screen.getByRole("button", { name: "ui" })).toBeInTheDocument();

      await userEvent.tab();
      // The suggestion's onMouseDown gets a 150ms window to fire first.
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "ui" })).not.toBeInTheDocument()
      );
    });
  });

  describe("column labels replace clipped placeholders (B5)", () => {
    it("shows a header row of column labels instead of placeholder text", () => {
      renderForm();

      expect(screen.getByText("Ingrediënt", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("Aantal")).toBeInTheDocument();
      expect(screen.getByText("Eenheid")).toBeInTheDocument();
      expect(screen.getAllByLabelText("Hoeveelheid")[0]).not.toHaveAttribute("placeholder");
      expect(screen.getAllByLabelText("Eenheid")[0]).not.toHaveAttribute("placeholder");
    });
  });
});
