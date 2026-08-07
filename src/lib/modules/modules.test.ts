import { describe, it, expect } from "vitest";
import { ALL_MODULES, visibleTabs } from "./modules";

describe("visibleTabs", () => {
  it("puts the shared list first, whatever the person hid", () => {
    expect(visibleTabs([])[0].href).toBe("/home");
    expect(visibleTabs(ALL_MODULES)[0].href).toBe("/home");
  });

  it("cannot hide the shared list, because nothing in the schema names it", () => {
    // Hiding everything hideable still leaves the app usable — the property
    // that makes "no switch on Mandje" a design decision rather than an
    // oversight in the settings screen.
    expect(visibleTabs(ALL_MODULES)).toHaveLength(1);
  });

  it("leaves out what the person hid and keeps the rest", () => {
    const hrefs = visibleTabs(["GELD"]).map((tab) => tab.href);
    expect(hrefs).not.toContain("/geld");

    const all = visibleTabs([]).map((tab) => tab.href);
    expect(all).toContain("/geld");
  });

  it("offers every module in the schema, so none ships unswitchable", () => {
    // The catalogue is what the settings screen renders; a module missing from
    // it would be a tab nobody can turn off.
    expect(visibleTabs([])).toHaveLength(ALL_MODULES.length + 1);
  });
});
