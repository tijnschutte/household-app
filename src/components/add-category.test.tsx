import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddCategory from "./add-category";
import { aCategory } from "@/tests/fixtures/house";
import { succeeds, fails } from "@/tests/fixtures/household";
import type { ViewKey } from "@/src/lib/house/grocery-view";

/**
 * A stand-in for the createCategory server action. It records the name and
 * scope it was handed, and returns the result the real action would return —
 * a rejection is a value here, exactly as it is over the wire.
 */
function fakeCreate(category = aCategory({ id: 9, name: "Jumbo" })) {
  const calls: Array<[string, ViewKey]> = [];
  let outcome = succeeds("Categorie aangemaakt", category);

  return {
    calls,
    rejectWith(message: string) {
      outcome = fails(message);
    },
    onCreateCategory: async (name: string, view: ViewKey) => {
      calls.push([name, view]);
      return outcome;
    },
  };
}

function renderDialog({
  view = "household",
  create = fakeCreate(),
}: { view?: ViewKey; create?: ReturnType<typeof fakeCreate> } = {}) {
  const onCategoryAdded = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AddCategory
      view={view}
      open
      onOpenChange={onOpenChange}
      onCategoryAdded={onCategoryAdded}
      onCreateCategory={create.onCreateCategory}
    />
  );
  return { create, onCategoryAdded, onOpenChange };
}

describe("AddCategory", () => {
  it("creates the category for the list the user is looking at", async () => {
    const { create } = renderDialog({ view: "personal" });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(create.calls).toEqual([["Jumbo", "personal"]]);
  });

  it("creates a shared category while the household list is open", async () => {
    const { create } = renderDialog({ view: "household" });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(create.calls).toEqual([["Jumbo", "household"]]);
  });

  it("hands the new category back so the caller can select it", async () => {
    const jumbo = aCategory({ id: 9, name: "Jumbo" });
    const { onCategoryAdded } = renderDialog({ create: fakeCreate(jumbo) });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(onCategoryAdded).toHaveBeenCalledWith(jumbo);
  });

  it("refuses a blank name without touching the server", async () => {
    const { create, onCategoryAdded } = renderDialog();

    await userEvent.type(screen.getByLabelText("Categorienaam"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(create.calls).toEqual([]);
    expect(onCategoryAdded).not.toHaveBeenCalled();
  });

  it("keeps the name on screen when the server rejects it", async () => {
    const create = fakeCreate();
    create.rejectWith("Categorie bestaat al");
    const { onCategoryAdded } = renderDialog({ create });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(screen.getByLabelText("Categorienaam")).toHaveValue("Jumbo");
    expect(onCategoryAdded).not.toHaveBeenCalled();
  });

  it("forgets an abandoned attempt when cancelled", async () => {
    const { create, onOpenChange } = renderDialog();

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(create.calls).toEqual([]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Categorienaam")).toHaveValue("");
  });
});
