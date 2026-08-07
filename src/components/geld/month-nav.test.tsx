import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import MonthNav from "./month-nav";

describe("MonthNav", () => {
  it("shows the month in Dutch", () => {
    render(<MonthNav month="2026-07" />);

    expect(screen.getByText("Juli 2026")).toBeInTheDocument();
  });

  it("navigates to the previous month", async () => {
    render(<MonthNav month="2026-07" />);

    await userEvent.click(screen.getByRole("button", { name: "Vorige maand" }));

    expect(useRouter().push).toHaveBeenCalledWith("/geld?maand=2026-06");
  });

  it("navigates to the next month", async () => {
    render(<MonthNav month="2026-07" />);

    await userEvent.click(screen.getByRole("button", { name: "Volgende maand" }));

    expect(useRouter().push).toHaveBeenCalledWith("/geld?maand=2026-08");
  });

  it("crosses the year boundary", async () => {
    render(<MonthNav month="2026-12" />);

    await userEvent.click(screen.getByRole("button", { name: "Volgende maand" }));

    expect(useRouter().push).toHaveBeenCalledWith("/geld?maand=2027-01");
  });
});
