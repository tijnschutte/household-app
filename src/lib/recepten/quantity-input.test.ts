import { describe, expect, it } from "vitest";
import { parseQuantity } from "@/src/lib/recepten/quantity-input";

describe("parseQuantity", () => {
  it("parses an empty string as no quantity", () => {
    expect(parseQuantity("")).toEqual({ ok: true, value: null });
    expect(parseQuantity("   ")).toEqual({ ok: true, value: null });
  });

  it("parses a plain number with a dot or a Dutch comma", () => {
    expect(parseQuantity("6.5")).toEqual({ ok: true, value: 6.5 });
    expect(parseQuantity("6,5")).toEqual({ ok: true, value: 6.5 });
    expect(parseQuantity("2")).toEqual({ ok: true, value: 2 });
  });

  it("parses a lone unicode vulgar fraction", () => {
    expect(parseQuantity("½")).toEqual({ ok: true, value: 0.5 });
    expect(parseQuantity("¼")).toEqual({ ok: true, value: 0.25 });
    expect(parseQuantity("¾")).toEqual({ ok: true, value: 0.75 });

    const third = parseQuantity("⅓");
    expect(third.ok).toBe(true);
    expect(third.ok && third.value).toBeCloseTo(1 / 3);

    const twoThirds = parseQuantity("⅔");
    expect(twoThirds.ok).toBe(true);
    expect(twoThirds.ok && twoThirds.value).toBeCloseTo(2 / 3);
  });

  it("parses a mixed number, with or without a space before the fraction", () => {
    expect(parseQuantity("1 ½")).toEqual({ ok: true, value: 1.5 });
    expect(parseQuantity("1½")).toEqual({ ok: true, value: 1.5 });
    expect(parseQuantity("2,5 ½")).toEqual({ ok: true, value: 3 });
  });

  it("reports anything else unparseable as not ok, rather than NaN", () => {
    expect(parseQuantity("abc")).toEqual({ ok: false });
    expect(parseQuantity("2/3")).toEqual({ ok: false });
    expect(parseQuantity("--")).toEqual({ ok: false });
  });
});
