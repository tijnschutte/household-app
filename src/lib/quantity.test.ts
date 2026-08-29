import { describe, expect, it } from "vitest";
import { formatQuantity } from "@/src/lib/quantity";

describe("formatQuantity", () => {
  it("renders nothing when both are null", () => {
    expect(formatQuantity(null, null)).toBe("");
  });

  it("renders the unit alone when quantity is null", () => {
    expect(formatQuantity(null, "snufje")).toBe("snufje");
  });

  it("renders the number alone when unit is null", () => {
    expect(formatQuantity(6, null)).toBe("6");
  });

  it("renders the number and unit together", () => {
    expect(formatQuantity(200, "gram")).toBe("200 gram");
  });

  it("uses a Dutch comma and drops trailing zeros", () => {
    expect(formatQuantity(6.5, null)).toBe("6,5");
    expect(formatQuantity(6.0, null)).toBe("6");
    expect(formatQuantity(0.25, null)).toBe("0,25");
  });
});
