// What a person actually types into the ingredient form's "aantal" field:
// plain numbers with a comma or a dot, unicode vulgar fractions (½ ¼ ¾ ⅓ ⅔),
// and a whole number plus one of those fractions ("1 ½" or "1½"). Its own pure
// module so the parse logic is unit-tested without rendering the form, and so
// the component only has to turn an already-classified result into a field
// error rather than re-deriving what counts as unparseable.

const VULGAR_FRACTIONS: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};

export type QuantityParseResult = { ok: true; value: number | null } | { ok: false };

/**
 * "" -> null (no quantity given). "6,5" / "6.5" -> 6.5. "½" -> 0.5. "1 ½" or
 * "1½" -> 1.5. Anything else that isn't a finite number is reported as
 * unparseable rather than turned into NaN — NaN is what used to reach the zod
 * schema and surface as "Expected number, received nan".
 */
export function parseQuantity(raw: string): QuantityParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  const fractionMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)?\s*([¼½¾⅓⅔])$/);
  if (fractionMatch) {
    const whole = fractionMatch[1] ? Number(fractionMatch[1].replace(",", ".")) : 0;
    return { ok: true, value: whole + VULGAR_FRACTIONS[fractionMatch[2]] };
  }

  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}
