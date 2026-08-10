import { describe, it, expect } from "vitest";
import { signUpSchema, signInSchema } from "./schema";
/**
 * These schemas are the only definition of what a valid credential is: the sign-up
 * action, the credentials provider and both forms all parse through them. The rules
 * are tested here so neither side has to restate them.
 */

const firstError = (result: { success: boolean; error?: { errors: { message: string }[] } }) =>
  result.success ? null : result.error!.errors[0].message;

describe("signUpSchema", () => {
  it("accepts an ordinary username and password", () => {
    expect(signUpSchema.safeParse({ username: "tijn", password: "geheim" }).success).toBe(true);
  });

  it("requires at least three characters of username", () => {
    expect(firstError(signUpSchema.safeParse({ username: "ti", password: "geheim" }))).toBe(
      "Gebruikersnaam moet minimaal 3 karakters zijn"
    );
  });

  it("requires at least three characters of password", () => {
    expect(firstError(signUpSchema.safeParse({ username: "tijn", password: "ge" }))).toBe(
      "Wachtwoord moet minimaal 3 karakters zijn"
    );
  });

  it("caps the username at fifteen characters", () => {
    expect(
      firstError(signUpSchema.safeParse({ username: "a".repeat(16), password: "geheim" }))
    ).toBe("Gebruikersnaam mag maximaal 15 karakters zijn");
  });

  // bcrypt silently ignores anything past 72 bytes, so a longer password would
  // not be the one that gets hashed.
  it("caps the password at seventy-two characters", () => {
    expect(firstError(signUpSchema.safeParse({ username: "tijn", password: "a".repeat(73) }))).toBe(
      "Wachtwoord mag maximaal 72 karakters zijn"
    );
  });

  it("rejects a space in the username", () => {
    expect(firstError(signUpSchema.safeParse({ username: "ti jn", password: "geheim" }))).toBe(
      "Gebruikersnaam mag geen spaties bevatten"
    );
  });

  it("rejects a space in the password", () => {
    expect(firstError(signUpSchema.safeParse({ username: "tijn", password: "ge heim" }))).toBe(
      "Wachtwoord mag geen spaties bevatten"
    );
  });
});

describe("signInSchema", () => {
  it("accepts the credentials of an existing account", () => {
    expect(signInSchema.safeParse({ username: "tijn", password: "geheim" }).success).toBe(true);
  });

  // Sign-in must not re-litigate password strength: an account created under
  // older rules still has to be able to log in.
  it("accepts any non-empty password, however short", () => {
    expect(signInSchema.safeParse({ username: "tijn", password: "a" }).success).toBe(true);
  });

  it("still requires a password", () => {
    expect(firstError(signInSchema.safeParse({ username: "tijn", password: "" }))).toBe(
      "Wachtwoord is vereist"
    );
  });

  it("rejects a space in the username", () => {
    expect(firstError(signInSchema.safeParse({ username: "ti jn", password: "geheim" }))).toBe(
      "Gebruikersnaam mag geen spaties bevatten"
    );
  });
});
