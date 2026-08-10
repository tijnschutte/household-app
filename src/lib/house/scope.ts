/**
 * Who owns a row on the boodschappenlijst — as a `where` clause for reading it,
 * and as the columns for writing one.
 *
 * Both lists live in the same two tables, told apart by which of `householdId`
 * and `userId` is set. That makes an omitted clause invisible rather than loud:
 * the query still runs, it just returns somebody else's shopping. So the rules
 * live here, named and in one place, instead of being retyped per action.
 */

/** The caller, as `requireUser()` returns them. Never assembled from client input. */
export type Caller = { userId: number; householdId: number | null };

/**
 * Every row the caller may touch: their household's shared rows and their own
 * personal ones. For a mutation that names a row by id, where which of the two
 * lists it came from does not matter.
 */
export function scopeToOwned({ userId, householdId }: Caller) {
  return householdId != null ? { OR: [{ householdId }, { userId }] } : { userId };
}

/**
 * Exactly one of the two lists — for reading it, or for checking that a
 * category the caller named belongs to it.
 *
 * The personal clause pins `householdId: null` because `{ userId }` alone would
 * also match the shared rows of a household this person is in.
 */
export function scopeToList({ userId, householdId }: Caller, personal: boolean) {
  if (personal) {
    return { userId, householdId: null };
  }

  // Unreachable: every caller decides what to do about a member with no
  // household before asking for their shared list. Loud, because a silent
  // `{ householdId: null }` here would match every personal row there is.
  if (householdId == null) {
    throw new Error("Cannot scope to a shared list without a household");
  }

  return { householdId };
}

/**
 * The owner columns a new row gets. Unlike the read clauses above, both are
 * always written: a row that set neither to null would appear on two lists.
 */
export function ownerOfList({ userId, householdId }: Caller, personal: boolean) {
  if (personal) {
    return { userId, householdId: null };
  }

  if (householdId == null) {
    throw new Error("Cannot file a row on a shared list without a household");
  }

  return { householdId, userId: null };
}
