import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BottomTabBar from "./bottom-tab-bar";

describe("BottomTabBar", () => {
  it("shows every tab when the person hid nothing", () => {
    render(<BottomTabBar hiddenModules={[]} />);

    expect(screen.getByRole("link", { name: "Mandje" })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: "Geld" })).toHaveAttribute("href", "/geld");
  });

  it("leaves out a tab the person hid, and keeps the list they cannot", () => {
    render(<BottomTabBar hiddenModules={["GELD"]} />);

    expect(screen.queryByRole("link", { name: "Geld" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mandje" })).toBeInTheDocument();
  });

  it("gives the remaining tabs the whole bar rather than leaving a gap", () => {
    const { container } = render(<BottomTabBar hiddenModules={["GELD", "RECEPTEN"]} />);

    // One column per surviving tab: hiding one is meant to widen the others,
    // which a fixed two-column grid would not do.
    expect(container.querySelector("nav > div")).toHaveStyle({
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    });
  });
});
