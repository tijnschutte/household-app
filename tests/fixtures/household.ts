/**
 * Builders for the household shapes. A test states only the fields it is
 * about; everything else gets a neutral default.
 */

import type { HouseholdWithMembers } from "@/src/lib/data";
import type { ActionResult } from "@/src/lib/action-result";

export function aHousehold(overrides: Partial<HouseholdWithMembers> = {}): HouseholdWithMembers {
  return {
    id: 1,
    name: "Familie Jansen",
    secret: "A1B2C3D4E5F6",
    members: [{ id: 1, name: "Tijn" }],
    ...overrides,
  };
}

/**
 * The two halves of an ActionResult, as a fake action returns them.
 *
 * `succeeds` carries the value the real action would return —
 * `succeeds("Aangemaakt", aCategory())` — or nothing for an action that
 * returns nothing. `fails` needs no value type at all: a failure looks the
 * same whatever the action would have returned, so one failure fits every
 * `ActionResult<T>` a fake is asked for.
 */
export function succeeds<T = void>(message: string, value?: T): ActionResult<T> {
  return { success: true, message, value: value as T };
}

export function fails(message: string): { success: false; message: string } {
  return { success: false, message };
}
