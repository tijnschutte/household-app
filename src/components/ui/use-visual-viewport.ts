"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

// Breathing room left between an overlay and the edges of what's visible.
const MARGIN_PX = 32;

/**
 * Style that keeps a vertically centred `position: fixed` overlay inside the
 * region the browser is actually showing.
 *
 * A fixed overlay is placed against the *layout* viewport, which iOS leaves at
 * full height when the keyboard opens — it shrinks and scrolls the *visual*
 * viewport instead, sliding the overlay's top off screen. Centring on the
 * visual viewport instead puts the overlay back where the user can read it.
 *
 * Undefined until measured, and on anything without the API, so callers keep
 * their CSS centring as the fallback.
 */
export function useVisualViewportCenter(): CSSProperties | undefined {
  const [center, setCenter] = useState<CSSProperties>();

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const measure = () =>
      setCenter({
        top: viewport.offsetTop + viewport.height / 2,
        maxHeight: viewport.height - MARGIN_PX,
      });

    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return center;
}
