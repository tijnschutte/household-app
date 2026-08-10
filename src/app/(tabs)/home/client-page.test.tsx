import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HouseholdClientPage, { type HomeActions } from "./client-page";
import { aCategory, aGrocery, aViewData } from "@/tests/fixtures/house";
import { succeeds, fails } from "@/tests/fixtures/household";
import type { ViewData, ViewKey } from "@/src/lib/house/grocery-view";

const householdId = 1;

/**
 * A stand-in for the whole home-page action set. Each entry records what it was
 * asked to do; `personalData` is what the personal list loads as, so a test can
 * check the two views are cached apart.
 */
function fakeActions({
  personalData = aViewData(),
  failCreate = false,
  failRename = false,
}: { personalData?: ViewData; failCreate?: boolean; failRename?: boolean } = {}) {
  const created: Array<[string, ViewKey, number | null | undefined]> = [];
  const bought: Array<[number, boolean]> = [];
  const deleted: number[][] = [];
  const restored: unknown[] = [];
  const renamed: Array<[number, string]> = [];
  const categoriesDeleted: number[] = [];
  const loaded: ViewKey[] = [];

  const actions: HomeActions = {
    onLoadData: async (view) => {
      loaded.push(view);
      return view === "personal" ? personalData : aViewData();
    },
    onCreateItem: async (name, view, categoryId) => {
      // A refusal is a returned result, not a throw — the same way the real
      // action reports "staat al in je lijst".
      if (failCreate) return fails("Toevoegen mislukt");
      created.push([name, view, categoryId]);
      return succeeds(
        "Toegevoegd",
        aGrocery({ id: 500 + created.length, name, categoryId: categoryId ?? null })
      );
    },
    onSetBought: async (id, next) => {
      bought.push([id, next]);
    },
    onDeleteItems: async (ids) => {
      deleted.push(ids);
    },
    onRestoreItems: async (items) => {
      restored.push(items);
    },
    onUpdateItemCategory: async () => {},
    onRenameItem: async (id, name) => {
      if (failRename) return fails('"karnemelk" staat al in je lijst');
      renamed.push([id, name]);
      return succeeds("Naam bijgewerkt");
    },
    onDeleteCategory: async (id) => {
      categoriesDeleted.push(id);
    },
    onCreateCategory: async (name) => succeeds("Categorie aangemaakt", aCategory({ id: 99, name })),
  };

  return { actions, created, bought, deleted, restored, renamed, categoriesDeleted, loaded };
}

function renderHome({
  initialData = aViewData({ items: [aGrocery({ id: 1, name: "melk" })] }),
  ...options
}: { initialData?: ViewData } & Parameters<typeof fakeActions>[0] = {}) {
  const fake = fakeActions(options);
  render(
    <HouseholdClientPage
      householdId={householdId}
      initialData={initialData}
      actions={fake.actions}
    />
  );
  return fake;
}

const addBar = () => screen.getByPlaceholderText("Voeg een item toe...");

describe("HouseholdClientPage", () => {
  it("shows the household list it was given, without asking the server again", () => {
    const fake = renderHome({
      initialData: aViewData({ items: [aGrocery({ id: 1, name: "melk" })] }),
    });

    expect(screen.getByText("melk")).toBeInTheDocument();
    expect(fake.loaded).toEqual([]);
  });

  describe("adding an item", () => {
    it("adds what was typed to the list the user is looking at", async () => {
      const fake = renderHome();

      await userEvent.type(addBar(), "brood");
      await userEvent.click(screen.getByRole("button", { name: "Item toevoegen" }));

      expect(fake.created).toEqual([["brood", "household", null]]);
    });

    it("shows the item straight away, before the server has answered", async () => {
      renderHome();

      await userEvent.type(addBar(), "brood");
      await userEvent.click(screen.getByRole("button", { name: "Item toevoegen" }));

      expect(screen.getByText("brood")).toBeInTheDocument();
    });

    it("clears the input so the next item can be typed right away", async () => {
      renderHome();

      await userEvent.type(addBar(), "brood");
      await userEvent.click(screen.getByRole("button", { name: "Item toevoegen" }));

      expect(addBar()).toHaveValue("");
    });

    it("adds on Enter too", async () => {
      const fake = renderHome();

      await userEvent.type(addBar(), "brood{Enter}");

      expect(fake.created).toEqual([["brood", "household", null]]);
    });

    it("refuses a blank name without touching the server", async () => {
      const fake = renderHome();

      await userEvent.type(addBar(), "   {Enter}");

      expect(fake.created).toEqual([]);
    });

    it("takes the item back off the list when the server refuses it", async () => {
      renderHome({ failCreate: true });

      await userEvent.type(addBar(), "brood{Enter}");

      expect(screen.queryByText("brood")).not.toBeInTheDocument();
      // The optimistic row has to be gone, not just emptied of its name: the
      // list is back to the one item it started with.
      expect(screen.getAllByRole("button", { name: /hernoemen$/ })).toHaveLength(1);
    });
  });

  describe("checking items off", () => {
    it("tells the server what was checked", async () => {
      const fake = renderHome({
        initialData: aViewData({ items: [aGrocery({ id: 1, name: "melk", bought: false })] }),
      });

      await userEvent.click(screen.getByText("melk"));

      expect(fake.bought).toEqual([[1, true]]);
    });

    it("offers to clear the basket once something is in it", () => {
      renderHome({
        initialData: aViewData({
          items: [aGrocery({ id: 1, name: "melk", bought: true })],
        }),
      });

      expect(screen.getByText("1 in je mandje")).toBeInTheDocument();
    });

    it("counts nothing in the basket while nothing is checked", async () => {
      const fake = renderHome({
        initialData: aViewData({ items: [aGrocery({ id: 1, bought: false })] }),
      });

      expect(screen.getByText("0 in je mandje")).toBeInTheDocument();

      // The bar is collapsed by CSS rather than unmounted, so the real
      // guarantee is that clearing an empty basket deletes nothing.
      await userEvent.click(screen.getByRole("button", { name: "Wissen" }));
      expect(fake.deleted).toEqual([]);
    });

    it("clears only the checked items", async () => {
      const fake = renderHome({
        initialData: aViewData({
          items: [
            aGrocery({ id: 1, name: "melk", bought: true }),
            aGrocery({ id: 2, name: "brood", bought: false }),
            aGrocery({ id: 3, name: "kaas", bought: true }),
          ],
        }),
      });

      await userEvent.click(screen.getByRole("button", { name: "Wissen" }));

      expect(fake.deleted).toEqual([[1, 3]]);
      expect(screen.queryByText("melk")).not.toBeInTheDocument();
      expect(screen.getByText("brood")).toBeInTheDocument();
    });
  });

  describe("renaming an item", () => {
    const rename = async (from: string, to: string) => {
      await userEvent.click(screen.getByRole("button", { name: `${from} hernoemen` }));
      // The add bar is a textbox too; the editor is the one holding the old name.
      const input = screen.getByDisplayValue(from);
      await userEvent.clear(input);
      await userEvent.type(input, `${to}{Enter}`);
    };

    it("lowercases the new name, so duplicates collapse however it was typed", async () => {
      const fake = renderHome();

      await rename("melk", "Halfvolle Melk");

      expect(fake.renamed).toEqual([[1, "halfvolle melk"]]);
    });

    it("shows the new name straight away, before the server has answered", async () => {
      renderHome();

      await rename("melk", "karnemelk");

      expect(screen.getByText("karnemelk")).toBeInTheDocument();
    });

    it("keeps the old name when the server refuses the new one", async () => {
      renderHome({ failRename: true });

      await rename("melk", "karnemelk");

      expect(screen.getByText("melk")).toBeInTheDocument();
      expect(screen.queryByText("karnemelk")).not.toBeInTheDocument();
    });
  });

  describe("the two lists", () => {
    it("loads the personal list the first time it is opened", async () => {
      const fake = renderHome({
        personalData: aViewData({ items: [aGrocery({ id: 9, name: "scheermesjes" })] }),
      });

      await userEvent.click(screen.getByRole("tab", { name: /Persoonlijk/ }));

      expect(fake.loaded).toContain("personal");
      expect(await screen.findByText("scheermesjes")).toBeInTheDocument();
    });

    it("keeps the two lists apart", async () => {
      renderHome({
        initialData: aViewData({ items: [aGrocery({ id: 1, name: "melk" })] }),
        personalData: aViewData({ items: [aGrocery({ id: 9, name: "scheermesjes" })] }),
      });

      await userEvent.click(screen.getByRole("tab", { name: /Persoonlijk/ }));
      await screen.findByText("scheermesjes");

      expect(screen.queryByText("melk")).not.toBeInTheDocument();
    });

    it("adds to the personal list while that one is open", async () => {
      const fake = renderHome();

      await userEvent.click(screen.getByRole("tab", { name: /Persoonlijk/ }));
      await userEvent.type(addBar(), "scheermesjes{Enter}");

      expect(fake.created).toEqual([["scheermesjes", "personal", null]]);
    });
  });

  describe("categories", () => {
    it("files a new item under the category picked in the add bar", async () => {
      const zuivel = aCategory({ id: 7, name: "Zuivel" });
      const fake = renderHome({
        initialData: aViewData({ items: [], categories: [zuivel] }),
      });

      await userEvent.click(screen.getByLabelText("Categorie voor nieuwe items"));
      await userEvent.click(screen.getByRole("option", { name: "Zuivel" }));
      await userEvent.type(addBar(), "melk{Enter}");

      expect(fake.created).toEqual([["melk", "household", 7]]);
    });

    it("puts the caret back in the item input once a category is picked", async () => {
      const zuivel = aCategory({ id: 7, name: "Zuivel" });
      renderHome({ initialData: aViewData({ items: [], categories: [zuivel] }) });

      await userEvent.click(screen.getByLabelText("Categorie voor nieuwe items"));
      await userEvent.click(screen.getByRole("option", { name: "Zuivel" }));

      expect(addBar()).toHaveFocus();
    });

    it("puts the caret in the name field when the picker opens the new-category dialog", async () => {
      renderHome({ initialData: aViewData({ items: [], categories: [] }) });

      await userEvent.click(screen.getByLabelText("Categorie voor nieuwe items"));
      await userEvent.click(screen.getByRole("option", { name: "Nieuwe categorie" }));

      expect(screen.getByLabelText("Categorienaam")).toHaveFocus();
    });

    it("keeps the items when their category is deleted", async () => {
      const zuivel = aCategory({ id: 7, name: "Zuivel" });
      const fake = renderHome({
        initialData: aViewData({
          items: [aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel })],
          categories: [zuivel],
        }),
      });

      await userEvent.click(screen.getByRole("button", { name: "Categorie Zuivel verwijderen" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Verwijderen" }));

      expect(fake.categoriesDeleted).toEqual([7]);
      expect(screen.getByText("melk")).toBeInTheDocument();
    });
  });
});
