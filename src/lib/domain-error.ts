/**
 * A failure the caller is expected to hit and the user is meant to read:
 * a name already taken, a month already paid, an item still in use.
 *
 * The distinction matters because of how a server action fails. Next redacts
 * the message of anything thrown out of one — in production the browser gets
 * "An error occurred in the Server Components render" and nothing else, so a
 * thrown Error can never carry copy to the user. Only a returned value can.
 *
 * So: throw this for a failure the boundary has declared, and `executeAction`
 * turns it into an ActionResult the screen can render. Throw anything else and
 * it stays thrown, because a bug should crash loudly rather than be dressed up
 * as a message about groceries.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
