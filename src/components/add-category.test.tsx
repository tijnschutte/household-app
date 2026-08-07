import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddCategory from "./add-category";
import { aCategory } from "@/tests/fixtures/house";

/**
 * A stand-in for the createCategory server action. It records the name and
 * scope it was handed, and returns the row the real action would return.
 */
function fakeCreate(result = aCategory({ id: 9, name: "Jumbo" })) {
  const calls: Array<[string, boolean]> = [];
  let failure: Error | null = null;

  return {
    calls,
    fail(error: Error) {
      failure = error;
    },
    onCreateCategory: async (name: string, personal: boolean) => {
      if (failure) throw failure;
      calls.push([name, personal]);
      return result;
    },
  };
}

function renderDialog({ showPersonal = false, create = fakeCreate() } = {}) {
  const onCategoryAdded = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AddCategory
      showPersonal={showPersonal}
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
    const { create } = renderDialog({ showPersonal: true });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(create.calls).toEqual([["Jumbo", true]]);
  });

  it("creates a shared category while the household list is open", async () => {
    const { create } = renderDialog({ showPersonal: false });

    await userEvent.type(screen.getByLabelText("Categorienaam"), "Jumbo");
    await userEvent.click(screen.getByRole("button", { name: "Categorie aanmaken" }));

    expect(create.calls).toEqual([["Jumbo", false]]);
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
    create.fail(new Error("Categorie bestaat al"));
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
