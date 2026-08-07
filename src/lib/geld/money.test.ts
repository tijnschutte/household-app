import { describe, it, expect, afterEach, vi } from "vitest";
import {
  formatEuro,
  parseEuroToCents,
  centsToInputValue,
  isValidMonth,
  currentMonth,
  shiftMonth,
  formatMonthLabel,
} from "./money";

// Intl separates the currency symbol with a non-breaking space. Spelling it out
// keeps these expectations diffable — a literal U+00A0 in the source is invisible
// and the failure ("expected '€ 87,00' to be '€ 87,00'") tells you nothing.
const NBSP = " ";
const euro = (amount: string) => `€${NBSP}${amount}`;

describe("formatEuro", () => {
  it("formats cents as a Dutch euro amount", () => {
    expect(formatEuro(8700)).toBe(euro("87,00"));
    expect(formatEuro(5)).toBe(euro("0,05"));
    expect(formatEuro(0)).toBe(euro("0,00"));
  });

  it("groups thousands the Dutch way", () => {
    expect(formatEuro(123456789)).toBe(euro("1.234.567,89"));
  });

  it("keeps the sign on a negative balance", () => {
    expect(formatEuro(-2500)).toBe(euro("-25,00"));
  });
});

describe("parseEuroToCents", () => {
  it("accepts a comma, a dot, or no decimal separator", () => {
    expect(parseEuroToCents("87,00")).toBe(8700);
    expect(parseEuroToCents("87.00")).toBe(8700);
    expect(parseEuroToCents("87")).toBe(8700);
  });

  it("accepts a single fraction digit", () => {
    expect(parseEuroToCents("87,5")).toBe(8750);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseEuroToCents("  87,00  ")).toBe(8700);
  });

  it("rounds rather than truncating the float", () => {
    // 8.29 * 100 is 828.9999... in binary floating point. Truncating would bill
    // the household a cent short on every amount that lands this way.
    expect(parseEuroToCents("8.29")).toBe(829);
    expect(parseEuroToCents("0.07")).toBe(7);
    expect(parseEuroToCents("1.005")).toBeNull(); // 3 fraction digits, not a rounding case
  });

  it("rejects anything that is not a plain positive amount", () => {
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("   ")).toBeNull();
    expect(parseEuroToCents("abc")).toBeNull();
    expect(parseEuroToCents("87,000")).toBeNull();
    expect(parseEuroToCents("€ 87,00")).toBeNull();
    expect(parseEuroToCents("87,00,00")).toBeNull();
  });

  it("rejects negatives, which callers express with a separate sign toggle", () => {
    expect(parseEuroToCents("-5")).toBeNull();
    expect(parseEuroToCents("-87,00")).toBeNull();
  });

  it("rejects a thousands separator, which would parse as the wrong amount", () => {
    // "1.234,56" must not silently become € 1,23.
    expect(parseEuroToCents("1.234,56")).toBeNull();
  });
});

describe("centsToInputValue", () => {
  it("renders cents as an editable decimal without a currency symbol", () => {
    expect(centsToInputValue(8700)).toBe("87,00");
    expect(centsToInputValue(5)).toBe("0,05");
    expect(centsToInputValue(0)).toBe("0,00");
  });

  it("round-trips through parseEuroToCents", () => {
    for (const cents of [0, 5, 99, 100, 8700, 123456789]) {
      expect(parseEuroToCents(centsToInputValue(cents))).toBe(cents);
    }
  });
});

describe("isValidMonth", () => {
  it("accepts a zero-padded YYYY-MM", () => {
    expect(isValidMonth("2026-01")).toBe(true);
    expect(isValidMonth("2026-12")).toBe(true);
  });

  it("rejects an out-of-range or malformed month", () => {
    expect(isValidMonth("2026-00")).toBe(false);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-7")).toBe(false);
    expect(isValidMonth("26-07")).toBe(false);
    expect(isValidMonth("2026-07-01")).toBe(false);
    expect(isValidMonth("")).toBe(false);
  });
});

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth("2026-07", 1)).toBe("2026-08");
    expect(shiftMonth("2026-07", -1)).toBe("2026-06");
    expect(shiftMonth("2026-07", 0)).toBe("2026-07");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("crosses several years", () => {
    expect(shiftMonth("2026-07", 12)).toBe("2027-07");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
    expect(shiftMonth("2026-07", 30)).toBe("2029-01");
  });

  it("always produces a month it would accept back", () => {
    let month = "2026-01";
    for (let i = 0; i < 24; i++) {
      month = shiftMonth(month, -1);
      expect(isValidMonth(month)).toBe(true);
    }
    expect(month).toBe("2024-01");
  });
});

describe("currentMonth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the month in Amsterdam, not UTC", () => {
    // 23:30 UTC on New Year's Eve is already 00:30 on 1 January in Amsterdam.
    // A UTC-based implementation would report the previous year's December and
    // open the Geld page on the wrong month.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T23:30:00Z"));
    expect(currentMonth()).toBe("2026-01");
  });

  it("reads the month in Amsterdam during summer time", () => {
    // CEST is UTC+2, so 22:30 UTC on 31 July is already 1 August locally.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T22:30:00Z"));
    expect(currentMonth()).toBe("2026-08");
  });

  it("produces a month the validator accepts", () => {
    expect(isValidMonth(currentMonth())).toBe(true);
  });
});

describe("formatMonthLabel", () => {
  it("names the month in Dutch, capitalized", () => {
    expect(formatMonthLabel("2026-01")).toBe("Januari 2026");
    expect(formatMonthLabel("2026-07")).toBe("Juli 2026");
    expect(formatMonthLabel("2026-12")).toBe("December 2026");
  });

  it("falls back to the raw month rather than rendering undefined", () => {
    expect(formatMonthLabel("2026-13")).toBe("13 2026");
  });
});
