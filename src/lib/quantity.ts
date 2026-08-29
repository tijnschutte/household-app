// Formatting for a quantity + unit pair, shared by the Mandje list (a recipe's
// ingredients land there with both set) and the Recepten detail screen. Pure,
// like geld/money.ts — no "use server" here, it runs on both client and server.

/** "6.5" -> "6,5" — Dutch comma, no trailing zeros. */
function formatNumber(value: number): string {
  const fixed = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return fixed.replace(".", ",");
}

/**
 * Renders a quantity/unit pair the way a list row or an ingredient line
 * shows it: the number first, the unit after, either one alone when the
 * other is null, and an empty string when both are — the caller decides
 * whether an empty string means "render nothing" or "omit this row".
 */
export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) {
    return unit ?? "";
  }
  const numberPart = formatNumber(quantity);
  return unit ? `${numberPart} ${unit}` : numberPart;
}
