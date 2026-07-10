// Pure money/month helpers for the Geld module. No "use server" here — these
// run on both client and server (formatting in components, parsing in forms,
// month arithmetic in the server page and client navigator alike).

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

/** Formats integer cents as a Dutch euro string, e.g. 8700 -> "€ 87,00". */
export function formatEuro(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/**
 * Parses a Dutch or plain decimal amount string ("87,00", "87.00", "87") into
 * positive integer cents. Returns null when the input isn't a valid amount.
 * Rejects negative input — callers that need a signed amount (adjustments)
 * combine this with a separate sign toggle.
 */
export function parseEuroToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept "1234", "1234,56", "1234.56" — a single decimal separator (comma
  // or dot) with 1-2 fraction digits. No thousands separators.
  const match = /^\d+([.,]\d{1,2})?$/.exec(trimmed);
  if (!match) return null;

  const normalized = trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 100);
}

/** Cents -> plain decimal input value (no currency symbol), e.g. 8700 -> "87,00". */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "YYYY-MM" format validator shared by client forms and server actions. */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

/** Current "YYYY-MM" in the Europe/Amsterdam timezone. */
export function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/** Shifts a "YYYY-MM" string by `delta` months (can be negative). */
export function shiftMonth(month: string, delta: number): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-based
  const total = year * 12 + monthIndex + delta;
  const newYear = Math.floor(total / 12);
  const newMonthIndex = ((total % 12) + 12) % 12;
  return `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}`;
}

const DUTCH_MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

/** "2026-07" -> "Juli 2026" (capitalized). */
export function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const monthName = DUTCH_MONTHS[Number(monthStr) - 1] ?? monthStr;
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${capitalized} ${yearStr}`;
}
