import { describe, expect, it } from "vitest";
import { parseDraft, withTrailingBlank } from "@/src/lib/recepten/recipe-form-lines";

describe("parseDraft", () => {
  it("normalises the name and unit and parses the quantity", () => {
    expect(parseDraft({ name: " Ui ", quantity: "1,5", unit: " Stuks " }, [])).toEqual({
      ok: true,
      line: { name: "ui", quantity: 1.5, unit: "stuks" },
    });
  });

  it("corrects a unit's spelling to the canonical one", () => {
    expect(parseDraft({ name: "bloem", quantity: "200", unit: "gram" }, [])).toEqual({
      ok: true,
      line: { name: "bloem", quantity: 200, unit: "g" },
    });
  });

  it("blanks a missing quantity and unit rather than inventing them", () => {
    expect(parseDraft({ name: "zout", quantity: "", unit: "  " }, [])).toEqual({
      ok: true,
      line: { name: "zout", quantity: null, unit: null },
    });
  });

  it("refuses a draft without a name", () => {
    expect(parseDraft({ name: "  ", quantity: "2", unit: "" }, [])).toEqual({
      ok: false,
      error: { field: "name", message: "Naam is vereist" },
    });
  });

  it("refuses a name already on the recipe, however it is spelled", () => {
    const existing = [{ name: "ui", quantity: null, unit: null }];

    expect(parseDraft({ name: " UI ", quantity: "", unit: "" }, existing)).toEqual({
      ok: false,
      error: { field: "name", message: "Staat al in dit recept" },
    });
  });

  it("refuses a quantity that is not a number", () => {
    expect(parseDraft({ name: "ui", quantity: "abc", unit: "" }, [])).toEqual({
      ok: false,
      error: { field: "quantity", message: "Hoeveelheid moet een getal zijn" },
    });
  });
});

describe("withTrailingBlank", () => {
  it("adds one blank and collapses several", () => {
    expect(withTrailingBlank([])).toEqual([""]);
    expect(withTrailingBlank(["a"])).toEqual(["a", ""]);
    expect(withTrailingBlank(["a", "", ""])).toEqual(["a", ""]);
  });
});
