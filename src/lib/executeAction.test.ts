import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { executeAction } from "./executeAction";
import { DomainError } from "./domain-error";

/**
 * Next reports a redirect by throwing an error carrying this digest. Building
 * one by hand keeps the test off `redirect()`, which tests/setup.ts stands in
 * for — and the test asserts Next still recognises the fabrication, so this
 * cannot quietly rot into a test that passes because nothing was a redirect.
 */
function aRedirect() {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/sign-in;307;",
  });
}

describe("executeAction", () => {
  it("hands back what the action returned, with the success message", async () => {
    const result = await executeAction({
      actionFn: async () => ({ id: 7 }),
      successMessage: "Toegevoegd",
    });

    expect(result).toEqual({ success: true, message: "Toegevoegd", value: { id: 7 } });
  });

  it("reports a declared domain failure as copy the screen can render", async () => {
    const result = await executeAction({
      actionFn: async () => {
        throw new DomainError('"brood" staat al in je lijst');
      },
    });

    expect(result).toEqual({ success: false, message: '"brood" staat al in je lijst' });
  });

  it("reports a rejected schema using the message written for the field", async () => {
    const naam = z.object({ name: z.string().min(3, "Naam is te kort") });

    const result = await executeAction({
      actionFn: async () => naam.parse({ name: "ab" }),
    });

    expect(result).toEqual({ success: false, message: "Naam is te kort" });
  });

  it("lets an unexpected failure crash rather than dressing it up as a message", async () => {
    await expect(
      executeAction({
        actionFn: async () => {
          throw new TypeError("cannot read properties of undefined");
        },
      })
    ).rejects.toThrow(TypeError);
  });

  it("lets a redirect through, because navigating is not failing", async () => {
    const redirect = aRedirect();
    expect(isRedirectError(redirect)).toBe(true);

    await expect(
      executeAction({
        actionFn: async () => {
          throw redirect;
        },
      })
    ).rejects.toBe(redirect);
  });
});
