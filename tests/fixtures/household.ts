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

export const succeeds = (message: string): ActionResult => ({ success: true, message });
export const fails = (message: string): ActionResult => ({ success: false, message });
