/**
 * What every action wrapped in `executeAction` reports back: it never throws
 * for an expected failure, it returns one. Lives in its own leaf module so a
 * client component can name the shape without importing the server-only
 * wrapper that produces it.
 */
export type ActionResult = { success: boolean; message: string };
