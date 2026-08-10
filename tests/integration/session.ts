/**
 * Who the server action under test thinks is calling it.
 *
 * Every action derives its scope from `auth()` and never from an argument —
 * that is the invariant these tests exist to guard, so a test must not be able
 * to pass a user id in. Instead it says who is holding the phone, and the
 * session mock in `setup.ts` reads it back the way a real request would.
 *
 * Lives in its own module because `vi.mock` factories are hoisted above the
 * test file's imports and cannot close over anything declared there.
 */

type Session = { user: { id: string; name: string } } | null;

let session: Session = null;

/** The signed-in caller, or null when nobody is. Read by the mocked `auth()`. */
export function currentSession(): Session {
  return session;
}

export function signInAs(user: { id: number; name: string }): void {
  session = { user: { id: String(user.id), name: user.name } };
}

export function signOut(): void {
  session = null;
}
