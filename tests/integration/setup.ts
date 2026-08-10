/**
 * Setup for the integration tests: real Prisma against a real Postgres, with
 * only the request itself standing in for itself.
 *
 * The unit suite fakes at the port and asserts on pure logic. These tests exist
 * for the one thing that cannot be proved that way: every query is scoped to
 * the caller. That rule lives in `where` clauses, unique constraints and
 * ownership lookups, so the only place it can be observed is a database.
 *
 * Nothing here stands in for our own code. The three mocks below are all
 * framework APIs that need an HTTP request to exist at all, and a vitest
 * process has none.
 */

import { afterEach, beforeAll, vi } from "vitest";

/**
 * Truncating the database is the whole point of this file, so refuse to do it
 * to anything that is not the throwaway one. `vitest.config.mts` points
 * DATABASE_URL here; a stray `.env` or a shell export must not be able to
 * redirect a TRUNCATE at the database someone is developing against.
 */
const TEST_DATABASE_SUFFIX = "_test";

function assertThrowawayDatabase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is unset — run the integration tests via `bun run test:integration`."
    );
  }

  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at "${name}", which does not end in ` +
        `"${TEST_DATABASE_SUFFIX}". These tests truncate every table.`
    );
  }
  return name;
}

assertThrowawayDatabase();

/**
 * The session. `auth()` reads a cookie off a request, so there is nothing for
 * it to read here — the test says who is calling instead. Mocking the whole
 * module also keeps NextAuth's initialization, which wants env and a request
 * context, out of the test process.
 */
vi.mock("@/src/lib/auth", async () => {
  const { currentSession } = await import("./session");
  return {
    auth: async () => currentSession(),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

/**
 * `after()` defers work until the response is sent, and throws outside a
 * request scope. Running the callback immediately is the closest honest
 * stand-in: the notification path still executes, so a bug that makes it throw
 * still surfaces — `notifyHousehold` promises it never does.
 *
 * The promises are collected so a test cannot truncate the database out from
 * under one still in flight.
 */
const deferred: Promise<unknown>[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    deferred.push(Promise.resolve(callback()));
  },
}));

/** Cache invalidation needs a request to invalidate for; there is none, and nothing to assert. */
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
}));

/**
 * Every table, read from the database rather than listed here: a model added
 * to schema.prisma must not be able to leave rows behind between tests.
 */
let tables: string[] = [];

beforeAll(async () => {
  const { default: db } = await import("@/src/lib/db/db");
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  tables = rows.map((row) => `"${row.tablename}"`);

  if (tables.length === 0) {
    throw new Error(
      "The test database has no tables — run `bun run test:integration`, which migrates it first."
    );
  }
});

afterEach(async () => {
  await Promise.all(deferred.splice(0));

  const { signOut } = await import("./session");
  signOut();

  const { default: db } = await import("@/src/lib/db/db");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
});
