import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { useRouter } from "next/navigation";
import RecipeDetailClient from "./recipe-detail-client";
import type { RecipeDetail } from "@/src/lib/recepten/view";
import type { ListRow } from "@/src/lib/recepten/basket";

function aRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    title: "Pasta pesto",
    steps: ["Kook de pasta.", "Meng met pesto."],
    tags: [{ id: 1, name: "Snel" }],
    ingredients: [
      { name: "pasta", quantity: 200, unit: "g" },
      { name: "pesto", quantity: null, unit: null },
    ],
    listRows: [],
    ...overrides,
  };
}

function aRow(overrides: Partial<ListRow> = {}): ListRow {
  return { id: 1, name: "pasta", quantity: null, unit: null, bought: false, ...overrides };
}

function fakeActions() {
  const added: { recipeId: number; names: string[] }[] = [];
  const deleted: number[] = [];
  let addRejects = false;
  return {
    added,
    deleted,
    rejectAdd() {
      addRejects = true;
    },
    onAddToBasket: async (recipeId: number, names: string[]) => {
      if (addRejects) throw new Error("mislukt");
      added.push({ recipeId, names });
    },
    onDelete: async (recipeId: number) => {
      deleted.push(recipeId);
    },
  };
}

function renderDetail(recipe = aRecipe(), fake = fakeActions()) {
  // Toasts are how this screen reports outcomes, so the test mounts the
  // Toaster the app layout would.
  render(
    <>
      <RecipeDetailClient
        recipe={recipe}
        onAddToBasket={fake.onAddToBasket}
        onDelete={fake.onDelete}
      />
      <Toaster />
    </>
  );
  return fake;
}

const sheet = () => screen.getByRole("dialog");

describe("RecipeDetailClient", () => {
  it("opens on the ingredients, quantity in its own column", () => {
    renderDetail();

    expect(screen.getByText("pasta")).toBeInTheDocument();
    expect(screen.getByText("200 g")).toBeInTheDocument();
  });

  it("marks an ingredient that is on the list and not bought", () => {
    renderDetail(
      aRecipe({ listRows: [aRow({ name: "pasta" }), aRow({ id: 2, name: "pesto", bought: true })] })
    );

    expect(screen.getAllByText("in mandje")).toHaveLength(1);
  });

  it("the switch's right side shows the steps, which can be ticked off", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("tab", { name: "Bereiding" }));
    expect(screen.queryByText("pasta")).not.toBeInTheDocument();

    const step = screen.getByRole("button", { name: /Kook de pasta/ });
    await user.click(step);
    expect(step).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Meng met pesto/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("links to the recipes it resembles", () => {
    renderDetail(aRecipe({ id: 5 }));

    expect(screen.getByRole("link", { name: "Lijkt op" })).toHaveAttribute(
      "href",
      "/recepten/5/lijkt-op"
    );
  });

  describe("In mandje", () => {
    it("opens a sheet with every ingredient ticked and adds what stays ticked", async () => {
      const user = userEvent.setup();
      const fake = renderDetail(aRecipe({ id: 42 }));

      await user.click(screen.getByRole("button", { name: "In mandje" }));
      const boxes = within(sheet()).getAllByRole("checkbox");
      expect(boxes).toHaveLength(2);
      expect(boxes.every((box) => box.getAttribute("aria-checked") === "true")).toBe(true);

      await user.click(within(sheet()).getByRole("checkbox", { name: /pesto/ }));
      await user.click(screen.getByRole("button", { name: "1 item toevoegen" }));

      await waitFor(() => expect(fake.added).toEqual([{ recipeId: 42, names: ["pasta"] }]));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(await screen.findByText("1 item in je mandje")).toBeInTheDocument();
      expect(useRouter().refresh).toHaveBeenCalled();
    });

    it("says per ingredient what the list will do with it", async () => {
      const user = userEvent.setup();
      renderDetail(
        aRecipe({
          ingredients: [
            { name: "pasta", quantity: 200, unit: "g" },
            { name: "kaas", quantity: 1, unit: "stuk" },
            { name: "ui", quantity: 1, unit: "bosje" },
            { name: "zout", quantity: null, unit: null },
          ],
          listRows: [
            aRow({ id: 1, name: "pasta", quantity: 200, unit: "g" }),
            aRow({ id: 2, name: "kaas", quantity: 1, unit: "stuk", bought: true }),
            aRow({ id: 3, name: "ui", quantity: 1, unit: "handje" }),
          ],
        })
      );

      await user.click(screen.getByRole("button", { name: "In mandje" }));

      expect(within(sheet()).getByText("staat al op de lijst · wordt 400 g")).toBeInTheDocument();
      expect(
        within(sheet()).getByText("al gekocht · komt opnieuw op de lijst")
      ).toBeInTheDocument();
      expect(
        within(sheet()).getByText("staat al op de lijst als 1 handje · wordt niet opgeteld")
      ).toBeInTheDocument();
      expect(within(sheet()).getByRole("checkbox", { name: /zout/ })).not.toHaveTextContent(
        "staat al"
      );
    });

    it("cannot confirm with nothing ticked", async () => {
      const user = userEvent.setup();
      renderDetail(aRecipe({ ingredients: [{ name: "pasta", quantity: null, unit: null }] }));

      await user.click(screen.getByRole("button", { name: "In mandje" }));
      await user.click(within(sheet()).getByRole("checkbox", { name: /pasta/ }));

      expect(screen.getByRole("button", { name: "0 items toevoegen" })).toBeDisabled();
    });

    it("reads 'Op de lijst' when every ingredient is already there unbought, and still opens the sheet", async () => {
      const user = userEvent.setup();
      renderDetail(
        aRecipe({ listRows: [aRow({ id: 1, name: "pasta" }), aRow({ id: 2, name: "pesto" })] })
      );

      const button = screen.getByRole("button", { name: "Op de lijst" });
      await user.click(button);

      expect(sheet()).toBeInTheDocument();
    });

    it("keeps the sheet open and toasts when the add fails", async () => {
      const user = userEvent.setup();
      const fake = fakeActions();
      fake.rejectAdd();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        renderDetail(aRecipe(), fake);

        await user.click(screen.getByRole("button", { name: "In mandje" }));
        await user.click(screen.getByRole("button", { name: "2 items toevoegen" }));

        expect(await screen.findByText("Toevoegen mislukt")).toBeInTheDocument();
        expect(sheet()).toBeInTheDocument();
        expect(consoleError).toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe("the ⋯ menu", () => {
    it("offers editing", async () => {
      const user = userEvent.setup();
      renderDetail(aRecipe({ id: 9 }));

      await user.click(screen.getByRole("button", { name: "Meer" }));

      expect(screen.getByRole("menuitem", { name: "Bewerken" })).toHaveAttribute(
        "href",
        "/recepten/9/bewerken"
      );
    });

    it("deletes after confirmation and goes back to the list", async () => {
      const user = userEvent.setup();
      const fake = renderDetail(aRecipe({ id: 9 }));

      await user.click(screen.getByRole("button", { name: "Meer" }));
      await user.click(screen.getByRole("menuitem", { name: "Verwijderen" }));
      expect(screen.getByText("Pasta pesto verwijderen?")).toBeInTheDocument();
      expect(fake.deleted).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Verwijderen" }));

      await waitFor(() => expect(fake.deleted).toEqual([9]));
      expect(useRouter().push).toHaveBeenCalledWith("/recepten");
    });

    it("cancelling the confirmation deletes nothing", async () => {
      const user = userEvent.setup();
      const fake = renderDetail();

      await user.click(screen.getByRole("button", { name: "Meer" }));
      await user.click(screen.getByRole("menuitem", { name: "Verwijderen" }));
      await user.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(fake.deleted).toEqual([]);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
