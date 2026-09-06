import { useRef, useState } from "react";
import { clampSwipeOffset, settleSwipeOffset, swipeIntent } from "./swipe-gesture";

/**
 * Swipe-to-delete on a list row: a leftward drag on the row body slides it
 * aside to reveal an action behind it, and snaps open or shut on release.
 *
 * The live offset is a ref, not state: following a finger is ~90 pointermove
 * events, and React only ever needs to know the two things returned as state —
 * whether a gesture is running, and whether it ended open. The pixels are
 * written straight to the surface node.
 *
 * `locked` hands the surface's transform to someone else (dnd-kit, while it is
 * dragging the row); no offset is written while it is set.
 */
export function useSwipeToDelete({ locked }: { locked: boolean }) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const offsetRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    baseX: 0,
    pointerId: -1,
    // idle → pending (pointer down) → swiping (horizontal intent) | cancelled (vertical intent)
    mode: "idle" as "idle" | "pending" | "swiping" | "cancelled",
  });
  // Set when a swipe gesture just ended, so the click that the browser fires
  // right after pointerup can be told apart from a tap.
  const justSwipedRef = useRef(false);

  // Safe to leave to the node between renders: the row's `style` never sets
  // transform unless dnd-kit is dragging, and React only writes the style
  // properties it manages — so a poll re-rendering the row leaves this alone.
  const applyOffset = () => {
    const node = surfaceRef.current;
    if (!node || locked) return;
    node.style.transform = offsetRef.current === 0 ? "" : `translateX(${offsetRef.current}px)`;
  };

  /** The single way a revealed row goes back to rest. */
  const close = () => {
    offsetRef.current = 0;
    applyOffset();
    setIsOpen(false);
  };

  /**
   * True exactly once after a swipe: for the click the browser synthesizes as
   * the finger lifts, which must not be taken for a tap on the row.
   */
  const consumeSwipeClick = () => {
    if (!justSwipedRef.current) return false;
    justSwipedRef.current = false;
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    // Gestures starting on the drag handle are dnd-kit's, not ours.
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
    const g = gestureRef.current;
    g.startX = e.clientX;
    g.startY = e.clientY;
    g.baseX = offsetRef.current;
    g.pointerId = e.pointerId;
    g.mode = "pending";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (e.pointerId !== g.pointerId) return;
    if (g.mode !== "pending" && g.mode !== "swiping") return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.mode === "pending") {
      const intent = swipeIntent(dx, dy);
      if (intent === "scroll") {
        g.mode = "cancelled";
        return;
      }
      if (intent === "undecided") return;
      g.mode = "swiping";
      setIsSwiping(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    offsetRef.current = clampSwipeOffset(g.baseX + dx);
    applyOffset();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (e.pointerId !== g.pointerId) return;
    if (g.mode === "swiping") {
      justSwipedRef.current = true;
      offsetRef.current = settleSwipeOffset(offsetRef.current);
      applyOffset();
      setIsSwiping(false);
      setIsOpen(offsetRef.current !== 0);
    }
    g.mode = "idle";
    g.pointerId = -1;
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (e.pointerId !== g.pointerId) return;
    if (g.mode === "swiping") {
      setIsSwiping(false);
      close();
    }
    g.mode = "idle";
    g.pointerId = -1;
  };

  /** The element the offset is written to; the row hands over its body node. */
  const setSurface = (node: HTMLElement | null) => {
    surfaceRef.current = node;
  };

  return {
    setSurface,
    isOpen,
    isSwiping,
    close,
    consumeSwipeClick,
    /** Spread onto the surface. `touch-pan-y` on it keeps native vertical scrolling. */
    surfaceHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
