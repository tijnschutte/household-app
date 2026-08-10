import { describe, it, expect } from "vitest";
import { groceryItemSchema, categorySchema } from "./schema";

/**
 * What the server accepts onto a list. The add bar has its own, stricter rules
 * in `grocery-view.ts` — these are the last word before a row is written.
 */

describe("groceryItemSchema", () => {
  it("accepts an ordinary item name", () => {
    expect(groceryItemSchema.safeParse({ name: "melk" }).success).toBe(true);
  });

  it("rejects a name that is only whitespace", () => {
    expect(groceryItemSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(groceryItemSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("trims the surrounding whitespace off a category name", () => {
    const result = categorySchema.safeParse({ name: "  Jumbo  " });

    expect(result.success && result.data.name).toBe("Jumbo");
  });

  it("rejects a name that is only whitespace", () => {
    expect(categorySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("caps a category name at thirty characters", () => {
    expect(categorySchema.safeParse({ name: "a".repeat(31) }).success).toBe(false);
  });
});
