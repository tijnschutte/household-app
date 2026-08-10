// The household as the Huis screen holds it. Split from data.ts for the same
// reason as geld/view.ts: that module opens with `import prisma`, this one is
// imported by a `"use client"` component, and only the split makes the
// separation something `.dependency-cruiser.cjs` can check.

import type { Household } from "@prisma/client";

/**
 * A household and who is in it. Members are narrowed to what the screen shows:
 * the row carries a password hash, and a prop is serialized into the RSC
 * payload whether the client reads it or not.
 */
export type HouseholdWithMembers = Household & {
  members: { id: number; name: string }[];
};
