import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroceryList from "./grocery-list";
import { aCategory, aGrocery } from "@/tests/fixtures/house";
import { MAX_ITEM_NAME_LENGTH } from "@/src/lib/house/grocery-view";

type Props = React.ComponentProps<typeof GroceryList>;

/**
 * Renders the list with neutral props and records what it asked its caller to
 * do. A test states only the props it is about.
 */
function renderList(overrides: Partial<Props> = {}) {
  const toggled: Array<[number, boolean]> = [];
  const renamed: Array<[number, string]> = [];
  const itemsDeleted: number[] = [];
  const categoriesDeleted: number[] = [];
  const addedTo: number[] = [];
  const busyRef = { current: false };

  const props: Props = {
    groceryList: [],
    categories: [],
    isLoading: false,
    onToggleBought: (id, bought) => toggled.push([id, bought]),
    onDragEnd: () => {},
    onDeleteCategory: (id) => categoriesDeleted.push(id),
    onRenameItem: (id, name) => renamed.push([id, name]),
    onAddToCategory: (id) => addedTo.push(id),
    onDeleteItem: (id) => itemsDeleted.push(id),
    busyRef,
    ...overrides,
  };

  const view = render(<GroceryList {...props} />);

  /** Re-renders with new props, the way a poll delivering fresh data would. */
  const update = (next: Partial<Props> = {}) => view.rerender(<GroceryList {...props} {...next} />);

  return { toggled, renamed, itemsDeleted, categoriesDeleted, addedTo, busyRef, update, ...view };
}

const zuivel = aCategory({ id: 7, name: "Zuivel" });

const header = (title: string) => screen.getByRole("heading", { name: new RegExp(title) });
const deleteAction = () => screen.queryByRole("button", { name: "Verwijderen" });

const POINTER = { pointerId: 1, isPrimary: true };

/** How long dnd-kit keeps its capture-phase click suppressor alive after a drag. */
const CLICK_SUPPRESSION_MS = 50;

/**
 * One horizontal drag across a row, in the three events a touch device sends.
 * Coordinates are absolute; the component only ever looks at the delta.
 */
function drag(target: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(target, { ...POINTER, clientX: from.x, clientY: from.y });
  fireEvent.pointerMove(target, { ...POINTER, clientX: to.x, clientY: to.y });
  fireEvent.pointerUp(target, { ...POINTER, clientX: to.x, clientY: to.y });
}

/** A swipe far enough left to snap the delete action open. */
const swipeOpen = (target: Element) => drag(target, { x: 200, y: 50 }, { x: 80, y: 50 });

describe("GroceryList", () => {
  describe("what it shows", () => {
    it("files each item under the header of its own category", () => {
      renderList({
        groceryList: [
          aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel }),
          aGrocery({ id: 2, name: "losse peer" }),
        ],
        categories: [zuivel],
      });

      expect(screen.getByText("melk")).toBeInTheDocument();
      expect(header("Zuivel")).toBeInTheDocument();
      expect(header("Geen categorie")).toBeInTheDocument();
    });

    it("counts what is still left to buy in the category header, not the rows", () => {
      renderList({
        groceryList: [
          aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel }),
          aGrocery({ id: 2, name: "yoghurt", categoryId: 7, category: zuivel, bought: true }),
        ],
        categories: [zuivel],
      });

      expect(within(header("Zuivel")).getByText("1")).toBeInTheDocument();
    });

    it("counts the same way in the uncategorized header", () => {
      renderList({
        groceryList: [
          aGrocery({ id: 1, name: "losse peer" }),
          aGrocery({ id: 2, name: "brood", bought: true }),
        ],
      });

      expect(within(header("Geen categorie")).getByText("1")).toBeInTheDocument();
    });

    it("hides a category that holds nothing, to keep the list tidy", () => {
      renderList({ groceryList: [], categories: [zuivel] });

      expect(screen.queryByRole("heading", { name: /Zuivel/ })).not.toBeInTheDocument();
    });

    it("keeps a fully checked category on screen — it still holds its items", () => {
      renderList({
        groceryList: [
          aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel, bought: true }),
        ],
        categories: [zuivel],
      });

      expect(header("Zuivel")).toBeInTheDocument();
      expect(screen.getByText("melk")).toBeInTheDocument();
      expect(within(header("Zuivel")).getByText("0")).toBeInTheDocument();
    });

    it("leaves out the uncategorized header while nothing is uncategorized", () => {
      renderList({
        groceryList: [aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel })],
        categories: [zuivel],
      });

      expect(screen.queryByRole("heading", { name: /Geen categorie/ })).not.toBeInTheDocument();
    });

    it("invites a first item when there is nothing at all", () => {
      renderList({ groceryList: [], categories: [] });

      expect(screen.getByText("Geen items")).toBeInTheDocument();
    });

    it("shows no rows and no empty state while the list is still loading", () => {
      renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })], isLoading: true });

      expect(screen.queryByText("melk")).not.toBeInTheDocument();
      expect(screen.queryByText("Geen items")).not.toBeInTheDocument();
    });
  });

  describe("checking items off", () => {
    it("reports the opposite of what the row currently is", async () => {
      const list = renderList({
        groceryList: [
          aGrocery({ id: 1, name: "melk", bought: false }),
          aGrocery({ id: 2, name: "brood", bought: true }),
        ],
      });

      await userEvent.click(screen.getByText("melk"));
      await userEvent.click(screen.getByText("brood"));

      expect(list.toggled).toEqual([
        [1, true],
        [2, false],
      ]);
    });

    it("treats a row that was never given a bought value as unchecked", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk", bought: null })] });

      await userEvent.click(screen.getByText("melk"));

      expect(list.toggled).toEqual([[1, true]]);
    });

    it("drops rename and drag from a checked row, leaving just the struck name", () => {
      const { container } = renderList({
        groceryList: [aGrocery({ id: 1, name: "melk", bought: true })],
      });

      expect(screen.queryByRole("button", { name: "melk hernoemen" })).not.toBeInTheDocument();
      expect(container.querySelector("[data-drag-handle]")).toBeNull();
    });
  });

  describe("renaming an item", () => {
    const openEditor = async (name = "melk") => {
      await userEvent.click(screen.getByRole("button", { name: `${name} hernoemen` }));
      return screen.getByRole("textbox");
    };

    it("offers the current name, and saves what was typed instead", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      expect(input).toHaveValue("melk");
      await userEvent.clear(input);
      await userEvent.type(input, "halfvolle melk{Enter}");

      expect(list.renamed).toEqual([[1, "halfvolle melk"]]);
    });

    it("saves when the field loses focus, so a tap elsewhere is not a lost edit", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      await userEvent.clear(input);
      await userEvent.type(input, "karnemelk");
      fireEvent.blur(input);

      expect(list.renamed).toEqual([[1, "karnemelk"]]);
    });

    it("abandons the edit on Escape, keeping the old name", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      await userEvent.clear(input);
      await userEvent.type(input, "karnemelk{Escape}");

      expect(list.renamed).toEqual([]);
      expect(screen.getByText("melk")).toBeInTheDocument();
    });

    it("ignores a name that did not change", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      await userEvent.type(await openEditor(), "{Enter}");

      expect(list.renamed).toEqual([]);
    });

    it("refuses a blank name and restores the old one", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      await userEvent.clear(input);
      await userEvent.type(input, "   {Enter}");

      expect(list.renamed).toEqual([]);
      expect(screen.getByText("melk")).toBeInTheDocument();
    });

    it("saves the name without the spaces around it", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      await userEvent.clear(input);
      await userEvent.type(input, "  karnemelk  {Enter}");

      expect(list.renamed).toEqual([[1, "karnemelk"]]);
    });

    it("stops at the shared name limit while typing, rather than truncating on save", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      await userEvent.clear(input);
      await userEvent.type(input, `${"a".repeat(MAX_ITEM_NAME_LENGTH + 5)}{Enter}`);

      expect(list.renamed).toEqual([[1, "a".repeat(MAX_ITEM_NAME_LENGTH)]]);
    });

    it("holds off the pollers while an edit is open, and lets go once it ends", async () => {
      const list = renderList({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      const input = await openEditor();
      expect(list.busyRef.current).toBe(true);

      await userEvent.type(input, "{Escape}");
      expect(list.busyRef.current).toBe(false);
    });
  });

  describe("swiping a row away", () => {
    const row = () => screen.getByText("melk");
    const oneItem = { groceryList: [aGrocery({ id: 1, name: "melk" })] };

    it("keeps the delete action out of reach until the row is swiped", () => {
      renderList(oneItem);

      expect(deleteAction()).not.toBeInTheDocument();
    });

    it("deletes just that item once the revealed action is used", async () => {
      const list = renderList(oneItem);

      swipeOpen(row());
      await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

      expect(list.itemsDeleted).toEqual([1]);
    });

    it("does not also check the item off, though the browser fires a click", () => {
      const list = renderList(oneItem);

      swipeOpen(row());
      fireEvent.click(row());

      expect(list.toggled).toEqual([]);
    });

    it("closes the revealed action on the next tap instead of checking the item off", () => {
      const list = renderList(oneItem);

      swipeOpen(row());
      fireEvent.click(row()); // the click the browser fires as the swipe ends
      fireEvent.click(row()); // the user's actual tap

      expect(deleteAction()).not.toBeInTheDocument();
      expect(list.toggled).toEqual([]);
    });

    it("snaps shut again when the swipe stops short of halfway", () => {
      renderList(oneItem);

      drag(row(), { x: 200, y: 50 }, { x: 175, y: 50 });

      expect(deleteAction()).not.toBeInTheDocument();
    });

    it("leaves a mostly vertical drag alone — that is the page scrolling", () => {
      const list = renderList(oneItem);

      drag(row(), { x: 200, y: 50 }, { x: 190, y: 200 });
      fireEvent.click(row());

      expect(deleteAction()).not.toBeInTheDocument();
      expect(list.toggled).toEqual([[1, true]]);
    });

    it("stays open when fresh data arrives, so a poll cannot snap it shut", () => {
      const list = renderList(oneItem);
      swipeOpen(row());

      list.update({ groceryList: [aGrocery({ id: 1, name: "melk" })] });

      expect(deleteAction()).toBeInTheDocument();
      expect(row().closest("[data-row-body]")).toHaveStyle({ transform: "translateX(-96px)" });
    });

    // Isolated because the gesture below trips dnd-kit's PointerSensor, which
    // suppresses clicks document-wide and only drops that listener 50ms after
    // teardown. The wait belongs to this test, not to whichever test happens
    // to follow it — as an afterEach it still holds if the file is reordered
    // or a single test is run on its own.
    describe("when the gesture belongs to dnd-kit", () => {
      afterEach(() => new Promise((resolve) => setTimeout(resolve, CLICK_SUPPRESSION_MS + 10)));

      it("leaves a gesture that starts on the drag handle alone", () => {
        const { container } = renderList(oneItem);

        swipeOpen(container.querySelector("[data-drag-handle]")!);

        expect(deleteAction()).not.toBeInTheDocument();
      });
    });
  });

  describe("category headers", () => {
    const withOneItem = {
      groceryList: [aGrocery({ id: 1, name: "melk", categoryId: 7, category: zuivel })],
      categories: [zuivel],
    };

    it("targets the add bar at the category whose plus was tapped", async () => {
      const list = renderList(withOneItem);

      await userEvent.click(screen.getByRole("button", { name: "Item toevoegen aan Zuivel" }));

      expect(list.addedTo).toEqual([7]);
    });

    it("offers no plus when the caller cannot take one", () => {
      renderList({ ...withOneItem, onAddToCategory: undefined });

      expect(
        screen.queryByRole("button", { name: "Item toevoegen aan Zuivel" })
      ).not.toBeInTheDocument();
    });

    it("asks before deleting a category that still holds items", async () => {
      const list = renderList(withOneItem);

      await userEvent.click(screen.getByRole("button", { name: "Categorie Zuivel verwijderen" }));

      expect(list.categoriesDeleted).toEqual([]);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("deletes the category once that is confirmed", async () => {
      const list = renderList(withOneItem);

      await userEvent.click(screen.getByRole("button", { name: "Categorie Zuivel verwijderen" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Verwijderen" }));

      expect(list.categoriesDeleted).toEqual([7]);
    });

    it("keeps the category when the question is dismissed", async () => {
      const list = renderList(withOneItem);

      await userEvent.click(screen.getByRole("button", { name: "Categorie Zuivel verwijderen" }));
      const dialog = screen.getByRole("alertdialog");
      await userEvent.click(within(dialog).getByRole("button", { name: "Annuleren" }));

      expect(list.categoriesDeleted).toEqual([]);
    });
  });
});
