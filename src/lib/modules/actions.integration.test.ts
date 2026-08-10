/**
 * Which tabs a person has switched off — one person's choice, across their
 * devices, and nobody else's.
 *
 * `getHiddenModules` also has to survive being called with no session at all:
 * it renders in the tab bar's layout, which Next runs alongside a page that is
 * still deciding to redirect to sign-in.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import { getHiddenModules, setModuleHidden } from "@/src/lib/modules/actions";
import { aHouseholdWith } from "@/tests/integration/factories";
import { signInAs, signOut } from "@/tests/integration/session";

describe("setModuleHidden", () => {
  it("stores the choice for the caller and reads it back", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setModuleHidden("GELD", true);

    expect(await getHiddenModules()).toEqual(["GELD"]);
  });

  it("un-hiding removes the row, because no row means visible", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setModuleHidden("GELD", true);
    await setModuleHidden("GELD", false);

    expect(await getHiddenModules()).toEqual([]);
    expect(await db.hiddenModule.count()).toBe(0);
  });

  it("hiding twice is not an error and does not add a second row", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setModuleHidden("GELD", true);
    await setModuleHidden("GELD", true);

    expect(await db.hiddenModule.count()).toBe(1);
  });

  it("does not hide the tab for a housemate", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });

    signInAs(member);
    await setModuleHidden("GELD", true);

    signInAs(housemate);
    expect(await getHiddenModules()).toEqual([]);
  });

  it("refuses a module that is not in the schema", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    await expect(setModuleHidden("DOCS", true)).rejects.toThrow();
    expect(await db.hiddenModule.count()).toBe(0);
  });
});

describe("getHiddenModules", () => {
  it("shows every tab to a caller with no session, rather than failing the shell", async () => {
    signOut();

    expect(await getHiddenModules()).toEqual([]);
  });
});
