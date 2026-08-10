import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdjustmentsSection from "./adjustments-section";
import { anAdjustment } from "@/tests/fixtures/geld";
import { succeeds, fails } from "@/tests/fixtures/household";

// Intl separates the currency symbol with a non-breaking space, but Testing
// Library normalizes that to a plain space before matching — so a DOM query
// writes a plain space, unlike the exact-string assertions in money.test.ts.
const euro = (amount: string) => `€ ${amount}`;

/**
 * A stand-in for the server actions. It records what it was asked to do and
 * reports the outcome, so a test can assert on what the user sees rather than
 * on the call itself. `rejectWith()` makes it refuse — a returned result, the
 * way the real action reports a rejected amount, not a throw.
 */
function fakeActions() {
  const addCalls: Array<[string, number, string | undefined]> = [];
  const deleteCalls: number[] = [];
  let rejection: string | null = null;

  return {
    addCalls,
    deleteCalls,
    rejectWith(message: string) {
      rejection = message;
    },
    onAddAdjustment: async (month: string, amountCents: number, note?: string) => {
      if (rejection) return fails(rejection);
      addCalls.push([month, amountCents, note]);
      return succeeds("Gelukt");
    },
    onDeleteAdjustment: async (id: number) => {
      if (rejection) return fails(rejection);
      deleteCalls.push(id);
      return succeeds("Gelukt");
    },
  };
}

function renderSection(adjustments = [anAdjustment({ id: 3, amountCents: 2_500 })]) {
  const actions = fakeActions();
  render(
    <AdjustmentsSection
      month="2026-07"
      adjustments={adjustments}
      onAddAdjustment={actions.onAddAdjustment}
      onDeleteAdjustment={actions.onDeleteAdjustment}
    />
  );
  return actions;
}

const openAddDialog = () =>
  userEvent.click(screen.getByRole("button", { name: "Correctie toevoegen" }));

describe("AdjustmentsSection", () => {
  it("marks a positive correction with a plus so the direction is readable", () => {
    renderSection([anAdjustment({ id: 1, amountCents: 2_500, note: "Teveel afgeschreven" })]);

    expect(screen.getByText("Teveel afgeschreven")).toBeInTheDocument();
    expect(screen.getByText(`+${euro("25,00")}`)).toBeInTheDocument();
  });

  it("shows a negative correction without adding a plus", () => {
    renderSection([anAdjustment({ id: 1, amountCents: -2_500, note: "Vergeten boodschappen" })]);

    expect(screen.getByText(euro("-25,00"))).toBeInTheDocument();
  });

  it("falls back to a generic label when a correction has no note", () => {
    renderSection([anAdjustment({ id: 1, amountCents: 500, note: null })]);

    expect(screen.getByText("Correctie")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", () => {
    renderSection([]);

    expect(screen.getByText("Geen correcties")).toBeInTheDocument();
  });

  describe("adding a correction", () => {
    it("adds the typed amount to the month as a plus, with the note", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "12,34");
      await userEvent.type(screen.getByLabelText("Notitie (optioneel)"), "  te veel betaald  ");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([["2026-07", 1_234, "te veel betaald"]]);
    });

    it("subtracts instead when the user picks Eraf", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.click(screen.getByRole("button", { name: /Eraf/ }));
      await userEvent.type(screen.getByLabelText("Bedrag"), "12,34");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([["2026-07", -1_234, undefined]]);
    });

    it("sends no note at all rather than an empty one", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "5");
      await userEvent.type(screen.getByLabelText("Notitie (optioneel)"), "   ");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([["2026-07", 500, undefined]]);
    });

    it("refuses an unparseable amount without touching the server", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "abc");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([]);
      expect(screen.getByLabelText("Bedrag")).toBeInTheDocument(); // dialog stayed open
    });

    it("refuses zero, which would correct nothing", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "0");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([]);
    });

    it("keeps the dialog open when the server rejects, so the input is not lost", async () => {
      const actions = renderSection();
      actions.rejectWith("Bedrag is te hoog");

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "12,34");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(screen.getByLabelText("Bedrag")).toHaveValue("12,34");
    });

    it("closes without adding anything when cancelled", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "12,34");
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(actions.addCalls).toEqual([]);
      expect(screen.queryByLabelText("Bedrag")).not.toBeInTheDocument();
    });

    it("forgets the abandoned attempt, so the next one starts blank", async () => {
      renderSection();

      await openAddDialog();
      await userEvent.click(screen.getByRole("button", { name: /Eraf/ }));
      await userEvent.type(screen.getByLabelText("Bedrag"), "12,34");
      await userEvent.type(screen.getByLabelText("Notitie (optioneel)"), "vergissing");
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      await openAddDialog();
      expect(screen.getByLabelText("Bedrag")).toHaveValue("");
      expect(screen.getByLabelText("Notitie (optioneel)")).toHaveValue("");
    });

    it("starts a new correction back on Erbij after an abandoned Eraf", async () => {
      const actions = renderSection();

      await openAddDialog();
      await userEvent.click(screen.getByRole("button", { name: /Eraf/ }));
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      await openAddDialog();
      await userEvent.type(screen.getByLabelText("Bedrag"), "5");
      await userEvent.click(screen.getByRole("button", { name: "Toevoegen" }));

      expect(actions.addCalls).toEqual([["2026-07", 500, undefined]]);
    });
  });

  describe("deleting a correction", () => {
    it("asks first, then deletes that correction", async () => {
      const actions = renderSection([anAdjustment({ id: 42, amountCents: 2_500 })]);

      await userEvent.click(screen.getByRole("button", { name: "Correctie verwijderen" }));
      expect(actions.deleteCalls).toEqual([]);

      await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

      expect(actions.deleteCalls).toEqual([42]);
    });

    it("deletes only the correction whose button was pressed", async () => {
      const actions = renderSection([
        anAdjustment({ id: 1, amountCents: 500, note: "Eerste" }),
        anAdjustment({ id: 2, amountCents: 900, note: "Tweede" }),
      ]);

      await userEvent.click(screen.getAllByRole("button", { name: "Correctie verwijderen" })[1]);
      await userEvent.click(screen.getByRole("button", { name: "Verwijderen" }));

      expect(actions.deleteCalls).toEqual([2]);
    });

    it("does nothing when the user backs out", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Correctie verwijderen" }));
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(actions.deleteCalls).toEqual([]);
    });
  });
});
