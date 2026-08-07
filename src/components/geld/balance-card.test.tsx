import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BalanceCard from "./balance-card";
import { aGeldMonth } from "@/tests/fixtures/geld";

describe("BalanceCard", () => {
  it("headlines the all-time balance, not the month's netto", () => {
    render(<BalanceCard data={aGeldMonth({ balanceCents: 128_450, netto: -2_500 })} />);

    expect(screen.getByText("Op rekening (nu)")).toBeInTheDocument();
    expect(screen.getByText("€ 1.284,50")).toBeInTheDocument();
    expect(screen.getByText("€ -25,00")).toBeInTheDocument();
  });

  it("mentions unpaid items when there are any", () => {
    render(<BalanceCard data={aGeldMonth({ unpaidCount: 3 })} />);

    expect(screen.getByText(/3 nog niet betaald/)).toBeInTheDocument();
  });

  it("says nothing about unpaid items when everything is paid", () => {
    render(<BalanceCard data={aGeldMonth({ unpaidCount: 0 })} />);

    expect(screen.queryByText(/nog niet betaald/)).not.toBeInTheDocument();
  });
});
