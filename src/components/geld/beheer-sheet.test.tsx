import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurringKind } from "@prisma/client";
import { useRouter } from "next/navigation";
import BeheerSheet from "./beheer-sheet";
import { currentMonth } from "@/src/lib/geld/money";
import { aRecurringItem } from "@/tests/fixtures/geld";
import { succeeds, fails } from "@/tests/fixtures/household";

/**
 * A stand-in for the server actions. It records what it was asked to do and
 * reports the outcome, so a test can assert on what the user sees rather than
 * on the call itself. `rejectWith()` makes it refuse — a returned result, the
 * way the real action reports "Bestaat al", not a throw.
 */
function fakeActions() {
  const created: Array<[string, RecurringKind, number, string]> = [];
  const updated: Array<[number, { name?: string; expectedCents?: number }]> = [];
  const ended: Array<[number, string]> = [];
  const deleted: number[] = [];
  let rejection: string | null = null;

  return {
    created,
    updated,
    ended,
    deleted,
    rejectWith(message: string) {
      rejection = message;
    },
    onCreateItem: async (
      name: string,
      kind: RecurringKind,
      expectedCents: number,
      activeFrom: string
    ) => {
      if (rejection) return fails(rejection);
      created.push([name, kind, expectedCents, activeFrom]);
      return succeeds("Gelukt");
    },
    onUpdateItem: async (id: number, updates: { name?: string; expectedCents?: number }) => {
      if (rejection) return fails(rejection);
      updated.push([id, updates]);
      return succeeds("Gelukt");
    },
    onEndItem: async (id: number, lastMonth: string) => {
      if (rejection) return fails(rejection);
      ended.push([id, lastMonth]);
      return succeeds("Gelukt");
    },
    onDeleteItem: async (id: number) => {
      if (rejection) return fails(rejection);
      deleted.push(id);
      return succeeds("Gelukt");
    },
  };
}

function renderSheet({
  items = [aRecurringItem()],
  autoAddKind = null,
}: { items?: ReturnType<typeof aRecurringItem>[]; autoAddKind?: RecurringKind | null } = {}) {
  const actions = fakeActions();
  render(
    <BeheerSheet
      open
      onOpenChange={vi.fn()}
      items={items}
      autoAddKind={autoAddKind}
      onCreateItem={actions.onCreateItem}
      onUpdateItem={actions.onUpdateItem}
      onEndItem={actions.onEndItem}
      onDeleteItem={actions.onDeleteItem}
    />
  );
  return actions;
}

const openAddDialog = () => userEvent.click(screen.getByRole("button", { name: "Post toevoegen" }));

describe("BeheerSheet", () => {
  describe("listing the recurring items", () => {
    it("says so when the household has no posts yet", () => {
      renderSheet({ items: [] });

      expect(screen.getByText("Nog geen posten toegevoegd.")).toBeInTheDocument();
    });

    it("describes a running post as active up to today", () => {
      renderSheet({ items: [aRecurringItem({ name: "Ziggo", activeFrom: "2026-01" })] });

      expect(screen.getByText("Ziggo")).toBeInTheDocument();
      expect(screen.getByText(/Januari 2026 – heden/)).toBeInTheDocument();
    });

    it("shows the closing month for a post that has ended", () => {
      renderSheet({ items: [aRecurringItem({ activeFrom: "2026-01", activeTo: "2026-06" })] });

      expect(screen.getByText(/Januari 2026 – Juni 2026/)).toBeInTheDocument();
    });

    it("offers no end button for a post that already ended", () => {
      renderSheet({ items: [aRecurringItem({ name: "Huur", activeTo: "2026-06" })] });

      expect(screen.queryByRole("button", { name: "Huur beëindigen" })).not.toBeInTheDocument();
    });
  });

  describe("creating a post", () => {
    it("creates the post with the typed name, amount and start month", async () => {
      const actions = renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Naam"), "  Ziggo  ");
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "45,50");
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(actions.created).toEqual([
        ["Ziggo", RecurringKind.CONTRIBUTION, 4_550, currentMonth()],
      ]);
    });

    it("creates an expense when that kind is picked", async () => {
      const actions = renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.click(screen.getByRole("button", { name: "Uitgave" }));
      await userEvent.type(screen.getByLabelText("Naam"), "Huur");
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "1000");
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(actions.created).toEqual([["Huur", RecurringKind.EXPENSE, 100_000, currentMonth()]]);
    });

    it("starts the post in the month the user chose", async () => {
      const actions = renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Naam"), "Huur");
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "10");
      fireEvent.change(screen.getByLabelText("Actief vanaf"), { target: { value: "2025-03" } });
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(actions.created).toEqual([["Huur", RecurringKind.CONTRIBUTION, 1_000, "2025-03"]]);
    });

    it("refuses a nameless post without touching the server", async () => {
      const actions = renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(actions.created).toEqual([]);
      expect(screen.getByLabelText("Naam")).toBeInTheDocument(); // dialog stayed open
    });

    it("refuses an amount of zero", async () => {
      const actions = renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Naam"), "Huur");
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "0");
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(actions.created).toEqual([]);
    });

    it("keeps the dialog open when the server rejects, so the input is not lost", async () => {
      const actions = renderSheet({ items: [] });
      actions.rejectWith("Bestaat al");

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Naam"), "Huur");
      await userEvent.type(screen.getByLabelText("Verwacht bedrag"), "10");
      await userEvent.click(screen.getByRole("button", { name: "Aanmaken" }));

      expect(screen.getByLabelText("Naam")).toHaveValue("Huur");
    });

    it("opens ready to add the kind the caller asked for", () => {
      renderSheet({ items: [], autoAddKind: RecurringKind.EXPENSE });

      // The sheet auto-opens the add dialog, so the form is there without a click.
      expect(screen.getByLabelText("Naam")).toBeInTheDocument();
    });

    it("starts from an empty form again after the user backed out", async () => {
      renderSheet({ items: [] });

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Naam"), "Huur");
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));
      await openAddDialog();

      expect(screen.getByLabelText("Naam")).toHaveValue("");
    });
  });

  describe("editing a post", () => {
    it("opens pre-filled with the current name and amount", async () => {
      renderSheet({ items: [aRecurringItem({ name: "Ziggo", expectedCents: 4_550 })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo bewerken" }));

      expect(screen.getByLabelText("Naam")).toHaveValue("Ziggo");
      expect(screen.getByLabelText("Verwacht bedrag")).toHaveValue("45,50");
    });

    it("pre-fills whichever post was picked, not the one edited before", async () => {
      renderSheet({
        items: [
          aRecurringItem({ id: 1, name: "Ziggo", expectedCents: 4_550 }),
          aRecurringItem({ id: 2, name: "Huur", expectedCents: 100_000 }),
        ],
      });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo bewerken" }));
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));
      await userEvent.click(screen.getByRole("button", { name: "Huur bewerken" }));

      expect(screen.getByLabelText("Naam")).toHaveValue("Huur");
      expect(screen.getByLabelText("Verwacht bedrag")).toHaveValue("1000,00");
    });

    it("saves the edited name and amount against that post", async () => {
      const actions = renderSheet({
        items: [aRecurringItem({ id: 12, name: "Ziggo", expectedCents: 4_550 })],
      });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo bewerken" }));
      const amount = screen.getByLabelText("Verwacht bedrag");
      await userEvent.clear(amount);
      await userEvent.type(amount, "52,00");
      await userEvent.click(screen.getByRole("button", { name: "Opslaan" }));

      expect(actions.updated).toEqual([[12, { name: "Ziggo", expectedCents: 5_200 }]]);
      expect(actions.created).toEqual([]);
    });

    it("does not offer to change the kind or start month of an existing post", async () => {
      renderSheet({ items: [aRecurringItem({ name: "Ziggo" })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo bewerken" }));

      expect(screen.queryByLabelText("Actief vanaf")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Uitgave" })).not.toBeInTheDocument();
    });
  });

  describe("ending a post", () => {
    it("ends it in the month the user picked", async () => {
      const actions = renderSheet({ items: [aRecurringItem({ id: 5, name: "Ziggo" })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo beëindigen" }));
      fireEvent.change(screen.getByLabelText("Laatste maand"), { target: { value: "2026-09" } });
      await userEvent.click(screen.getByRole("button", { name: "Beëindigen" }));

      expect(actions.ended).toEqual([[5, "2026-09"]]);
    });

    it("defaults to ending it this month", async () => {
      const actions = renderSheet({ items: [aRecurringItem({ id: 5, name: "Ziggo" })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo beëindigen" }));
      await userEvent.click(screen.getByRole("button", { name: "Beëindigen" }));

      expect(actions.ended).toEqual([[5, currentMonth()]]);
    });
  });

  describe("deleting a post", () => {
    it("asks first, then deletes that post", async () => {
      const actions = renderSheet({ items: [aRecurringItem({ id: 8, name: "Ziggo" })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo verwijderen" }));
      expect(actions.deleted).toEqual([]);

      await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

      expect(actions.deleted).toEqual([8]);
    });

    it("does nothing when the user backs out", async () => {
      const actions = renderSheet({ items: [aRecurringItem({ name: "Ziggo" })] });

      await userEvent.click(screen.getByRole("button", { name: "Ziggo verwijderen" }));
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(actions.deleted).toEqual([]);
    });

    it("refuses to delete a post that already has payments against it", () => {
      renderSheet({ items: [aRecurringItem({ name: "Ziggo", hasEntries: true })] });

      expect(screen.getByRole("button", { name: "Ziggo verwijderen" })).toBeDisabled();
    });

    // The button above is disabled on what the page was rendered with, so the
    // server's refusal is what covers someone paying the post in another tab
    // between the render and the click. Radix closes the confirm on either
    // outcome, so what separates them is that a refused delete leaves the page
    // alone — there is nothing new to read.
    it("does not refresh the page when the server refuses the delete", async () => {
      const actions = renderSheet({ items: [aRecurringItem({ id: 8, name: "Ziggo" })] });
      actions.rejectWith("Item is al gebruikt — beëindig het in plaats van verwijderen");

      await userEvent.click(screen.getByRole("button", { name: "Ziggo verwijderen" }));
      await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

      expect(useRouter().refresh).not.toHaveBeenCalled();
    });
  });
});
