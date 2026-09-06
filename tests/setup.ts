/**
 * Shared setup for component tests.
 *
 * Everything here is a boundary a component cannot control — the DOM matchers, the
 * previous render, the Next router. Nothing here stands in for our own code: a test
 * that needs different data passes different props, and a test that needs a server
 * action passes a fake in, as the testing philosophy in CLAUDE.md asks.
 */

import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import failOnConsole from "vitest-fail-on-console";

/**
 * React reports a missing key, invalid DOM nesting or an un-acted update through
 * console.error, not by throwing, so without this a suite can be green while the
 * component is wrong. A test that expects a message asserts on a console spy.
 *
 * Registered before `cleanup` on purpose: afterEach hooks run last-in first-out,
 * and a failing hook skips the rest, so the guard failing must not leave the
 * previous render mounted for the next test to trip over.
 */
failOnConsole({ shouldFailOnError: true, shouldFailOnWarn: true });

/** Testing Library keeps the previous render mounted unless it is told otherwise. */
afterEach(cleanup);

/**
 * The App Router hooks only exist inside a Next request, so a component that
 * navigates has nothing to call in a test. This is the router itself standing in
 * for the framework, not a stand-in for anything we wrote.
 *
 * A test that asserts on navigation imports `useRouter` from next/navigation and
 * reads the calls off it.
 */
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

/**
 * next-auth's browser helpers talk to /api/auth over the network, which does not
 * exist in a test process. They are client-only functions, so a server page cannot
 * hand them down the way it hands down a server action — this is the framework
 * standing in for itself, like the router above.
 *
 * `signIn` resolves undefined by default, which the forms read as success. A test
 * that wants a rejected login overrides it with mockResolvedValue({ error }).
 */
const auth = {
  signIn: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("next-auth/react", () => auth);

afterEach(() => {
  Object.values(router).forEach((fn) => fn.mockClear());
  Object.values(auth).forEach((fn) => fn.mockReset());
});
