import { describe, expect, it } from "vitest";
import { canonicalUnit } from "@/src/lib/recepten/units";

describe("canonicalUnit", () => {
  it("collapses the spellings of one unit onto one string", () => {
    expect(canonicalUnit("gram")).toBe("g");
    expect(canonicalUnit(" GR ")).toBe("g");
    expect(canonicalUnit("Eetlepels")).toBe("el");
    expect(canonicalUnit("theelepel")).toBe("tl");
    expect(canonicalUnit("stuk")).toBe("stuks");
    expect(canonicalUnit("kilo")).toBe("kg");
    expect(canonicalUnit("liter")).toBe("l");
  });

  it("lets an unknown unit through, trimmed and lowercased", () => {
    expect(canonicalUnit(" Bosje ")).toBe("bosje");
  });

  it("reads a blank as no unit", () => {
    expect(canonicalUnit("")).toBeNull();
    expect(canonicalUnit("  ")).toBeNull();
    expect(canonicalUnit(null)).toBeNull();
  });
});
