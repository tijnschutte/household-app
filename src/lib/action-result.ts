/**
 * What every action wrapped in `executeAction` reports back: it never throws
 * for an expected failure, it returns one. Lives in its own leaf module so a
 * client component can name the shape without importing the server-only
 * wrapper that produces it.
 *
 * Discriminated on `success`, so reading `message` off a failure is checked
 * and reading `value` off one does not compile — the screen cannot forget that
 * an action it called might not have done anything.
 */
export type ActionResult<T = void> =
  { success: true; message: string; value: T } | { success: false; message: string };
