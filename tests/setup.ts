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

afterEach(() => {
  Object.values(router).forEach((fn) => fn.mockClear());
});
