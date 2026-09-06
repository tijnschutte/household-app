// One spelling per unit. "g", "gram" and "gr" are the same unit, and the list
// merge (basket.ts) can only add two lines up when their units are the same
// string, so every unit is canonicalised the moment it enters the system —
// the form when a line is added, the schema when a recipe is saved. Units not
// in this table pass through trimmed and lowercased; the merge still works
// for them as long as people spell them the same way.

const ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  grammen: "g",
  kg: "kg",
  kilo: "kg",
  kilogram: "kg",
  ml: "ml",
  milliliter: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  el: "el",
  eetlepel: "el",
  eetlepels: "el",
  tl: "tl",
  theelepel: "tl",
  theelepels: "tl",
  stuk: "stuks",
  stuks: "stuks",
  st: "stuks",
};

/** "" -> null (no unit); "Gram" -> "g"; "bosje" -> "bosje". */
export function canonicalUnit(raw: string | null | undefined): string | null {
  const unit = (raw ?? "").trim().toLowerCase();
  if (unit === "") return null;
  return ALIASES[unit] ?? unit;
}
