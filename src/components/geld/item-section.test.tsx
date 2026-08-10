import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ItemSection from "./item-section";
import { aGeldItem } from "@/tests/fixtures/geld";
import { succeeds, fails } from "@/tests/fixtures/household";

/**
 * A stand-in for the server actions. It records what it was asked to do and
 * reports the outcome, so a test can assert on what the user sees rather than
 * on the call itself. `rejectWith()` makes it refuse — a returned result, the
 * way the real action reports "Al betaald", not a throw.
 */
function fakeActions() {
  const markPaidCalls: Array<[number, string, number]> = [];
  const undoPaidCalls: Array<[number, string]> = [];
  let rejection: string | null = null;

  return {
    markPaidCalls,
    undoPaidCalls,
    rejectWith(message: string) {
      rejection = message;
    },
    onMarkPaid: async (id: number, month: string, cents: number) => {
      if (rejection) return fails(rejection);
      markPaidCalls.push([id, month, cents]);
      return succeeds("Gelukt");
    },
    onUndoPaid: async (id: number, month: string) => {
      if (rejection) return fails(rejection);
      undoPaidCalls.push([id, month]);
      return succeeds("Gelukt");
    },
  };
}

function renderSection(items = [aGeldItem({ id: 7, name: "Huur", expectedCents: 100_000 })]) {
  const actions = fakeActions();
  render(
    <ItemSection
      title="Uitgaven"
      items={items}
      month="2026-07"
      onAdd={vi.fn()}
      addLabel="Uitgave toevoegen"
      onMarkPaid={actions.onMarkPaid}
      onUndoPaid={actions.onUndoPaid}
    />
  );
  return actions;
}

describe("ItemSection", () => {
  it("lists each item with the amount still expected", () => {
    renderSection([
      aGeldItem({ id: 1, name: "Huur", expectedCents: 100_000 }),
      aGeldItem({ id: 2, name: "Energie", expectedCents: 8_750 }),
    ]);

    expect(screen.getByText("Huur")).toBeInTheDocument();
    expect(screen.getByText("€ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("€ 87,50")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", () => {
    renderSection([]);

    expect(screen.getByText("Geen items")).toBeInTheDocument();
  });

  it("shows the amount actually paid once an item has an entry", () => {
    renderSection([
      aGeldItem({
        id: 1,
        name: "Huur",
        expectedCents: 100_000,
        entry: { id: 9, amountCents: 95_000, paidAt: new Date("2026-07-03T10:00:00Z") },
      }),
    ]);

    expect(screen.getByText("€ 950,00")).toBeInTheDocument();
    expect(screen.queryByText("€ 1.000,00")).not.toBeInTheDocument();
  });

  describe("marking an item paid", () => {
    it("offers the expected amount, and pays that amount when confirmed", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      expect(screen.getByLabelText("Bedrag")).toHaveValue("1000,00");

      await userEvent.click(screen.getByRole("button", { name: "Bevestigen" }));

      expect(actions.markPaidCalls).toEqual([[7, "2026-07", 100_000]]);
    });

    it("pays the amount the user typed instead", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      const amount = screen.getByLabelText("Bedrag");
      await userEvent.clear(amount);
      await userEvent.type(amount, "912,34");
      await userEvent.click(screen.getByRole("button", { name: "Bevestigen" }));

      expect(actions.markPaidCalls).toEqual([[7, "2026-07", 91_234]]);
    });

    it("refuses an unparseable amount without touching the server", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      const amount = screen.getByLabelText("Bedrag");
      await userEvent.clear(amount);
      await userEvent.type(amount, "abc");
      await userEvent.click(screen.getByRole("button", { name: "Bevestigen" }));

      expect(actions.markPaidCalls).toEqual([]);
      expect(screen.getByLabelText("Bedrag")).toBeInTheDocument(); // dialog stayed open
    });

    it("refuses zero, which would record a payment of nothing", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      const amount = screen.getByLabelText("Bedrag");
      await userEvent.clear(amount);
      await userEvent.type(amount, "0");
      await userEvent.click(screen.getByRole("button", { name: "Bevestigen" }));

      expect(actions.markPaidCalls).toEqual([]);
    });

    it("keeps the dialog open when the server rejects, so the amount is not lost", async () => {
      const actions = renderSection();
      actions.rejectWith("Item is niet actief in deze maand");

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      await userEvent.click(screen.getByRole("button", { name: "Bevestigen" }));

      expect(screen.getByLabelText("Bedrag")).toBeInTheDocument();
    });

    it("closes without paying when cancelled", async () => {
      const actions = renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(actions.markPaidCalls).toEqual([]);
    });
  });

  describe("undoing a payment", () => {
    const paid = [
      aGeldItem({
        id: 7,
        name: "Huur",
        expectedCents: 100_000,
        entry: { id: 9, amountCents: 95_000, paidAt: new Date("2026-07-03T10:00:00Z") },
      }),
    ];

    it("asks first, then undoes the payment for that month", async () => {
      const actions = renderSection(paid);

      await userEvent.click(screen.getByRole("button", { name: "Huur: betaling ongedaan maken" }));
      expect(actions.undoPaidCalls).toEqual([]);

      await userEvent.click(screen.getByRole("button", { name: "Ongedaan maken" }));

      expect(actions.undoPaidCalls).toEqual([[7, "2026-07"]]);
    });

    it("does nothing when the user backs out", async () => {
      const actions = renderSection(paid);

      await userEvent.click(screen.getByRole("button", { name: "Huur: betaling ongedaan maken" }));
      await userEvent.click(screen.getByRole("button", { name: "Sluiten" }));

      expect(actions.undoPaidCalls).toEqual([]);
    });

    it("does not offer undo for an item that was never paid", async () => {
      renderSection();

      await userEvent.click(screen.getByRole("button", { name: "Huur: markeer als betaald" }));

      expect(screen.queryByRole("button", { name: "Ongedaan maken" })).not.toBeInTheDocument();
    });
  });
});
