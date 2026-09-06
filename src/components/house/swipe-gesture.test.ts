import { describe, it, expect } from "vitest";
import {
  SWIPE_ACTION_WIDTH,
  clampSwipeOffset,
  settleSwipeOffset,
  swipeIntent,
} from "./swipe-gesture";

describe("swipeIntent", () => {
  it("stays undecided while the pointer has barely moved", () => {
    expect(swipeIntent(5, 3)).toBe("undecided");
    expect(swipeIntent(-12, 0)).toBe("undecided");
  });

  it("claims a mostly horizontal movement as a swipe, in either direction", () => {
    expect(swipeIntent(-30, 4)).toBe("swipe");
    expect(swipeIntent(30, 4)).toBe("swipe");
  });

  it("leaves a mostly vertical movement to the page as a scroll", () => {
    expect(swipeIntent(4, 40)).toBe("scroll");
    expect(swipeIntent(4, -40)).toBe("scroll");
  });

  it("does not pick a side for a diagonal that clears the threshold both ways", () => {
    expect(swipeIntent(20, 20)).toBe("undecided");
  });
});

describe("clampSwipeOffset", () => {
  it("never lets the row move right of rest", () => {
    expect(clampSwipeOffset(30)).toBe(0);
  });

  it("follows the finger left up to the action plus a little overshoot", () => {
    expect(clampSwipeOffset(-50)).toBe(-50);
    expect(clampSwipeOffset(-500)).toBe(-SWIPE_ACTION_WIDTH - 24);
  });
});

describe("settleSwipeOffset", () => {
  it("snaps open once past half the action width", () => {
    expect(settleSwipeOffset(-SWIPE_ACTION_WIDTH / 2 - 1)).toBe(-SWIPE_ACTION_WIDTH);
  });

  it("snaps shut when released at or short of halfway", () => {
    expect(settleSwipeOffset(-SWIPE_ACTION_WIDTH / 2)).toBe(0);
    expect(settleSwipeOffset(-10)).toBe(0);
  });
});
