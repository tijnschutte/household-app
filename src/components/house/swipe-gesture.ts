// The arithmetic of swiping a row left to reveal its delete action. Pure, so
// the thresholds can be read and tested without a pointer or a render.

/** Width of the red "Verwijderen" action revealed by swiping a row left. */
export const SWIPE_ACTION_WIDTH = 96;
// A gesture must move this many px before we decide it's a swipe or a scroll.
const SWIPE_INTENT_THRESHOLD = 12;
// How far past the action the finger may pull the row before it stops following.
const SWIPE_OVERSHOOT = 24;

/**
 * What a pointer that has moved (dx, dy) since it went down is doing.
 * "undecided" until it clears the threshold in one direction; the browser
 * owns a scroll, we own a swipe.
 */
export type SwipeIntent = "undecided" | "swipe" | "scroll";

export function swipeIntent(dx: number, dy: number): SwipeIntent {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (vertical > SWIPE_INTENT_THRESHOLD && vertical > horizontal) return "scroll";
  if (horizontal > SWIPE_INTENT_THRESHOLD && horizontal > vertical) return "swipe";
  return "undecided";
}

/** Where the row sits while following a finger: only leftward, with a little overshoot room. */
export function clampSwipeOffset(offset: number): number {
  return Math.min(0, Math.max(-SWIPE_ACTION_WIDTH - SWIPE_OVERSHOOT, offset));
}

/** Where a released row snaps to: open when past half the action width, else shut. */
export function settleSwipeOffset(offset: number): number {
  return offset < -SWIPE_ACTION_WIDTH / 2 ? -SWIPE_ACTION_WIDTH : 0;
}
