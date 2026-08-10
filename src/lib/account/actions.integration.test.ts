/**
 * Signing up, against a real database.
 *
 * `schema.test.ts` already proves which credentials are valid. What only a
 * database can show is that the password never lands in a column as typed, and
 * that a taken username is refused by the unique index rather than by a read
 * that another sign-up could slip past.
 */

import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import db from "@/src/lib/db/db";
import { signUp } from "@/src/lib/account/actions";
import { aLoneUser } from "@/tests/integration/factories";

function credentials(username: string, password: string): FormData {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
}

describe("signUp", () => {
  it("stores the password hashed, never as typed", async () => {
    const result = await signUp(credentials("sam", "hunter22"));

    expect(result.success).toBe(true);
    const user = await db.user.findFirstOrThrow({ where: { name: "sam" } });
    expect(user.password).not.toBe("hunter22");
    expect(await bcrypt.compare("hunter22", user.password)).toBe(true);
  });

  it("leaves the new account outside any household", async () => {
    await signUp(credentials("sam", "hunter22"));

    expect(await db.user.findFirstOrThrow({ where: { name: "sam" } })).toMatchObject({
      householdId: null,
    });
  });

  it("reports a username that is already taken", async () => {
    await aLoneUser("sam");

    expect(await signUp(credentials("sam", "hunter22"))).toMatchObject({ success: false });
    expect(await db.user.count()).toBe(1);
  });

  it("reports a password the schema refuses, without creating anything", async () => {
    expect(await signUp(credentials("sam", "ge heim"))).toMatchObject({ success: false });
    expect(await db.user.count()).toBe(0);
  });
});
