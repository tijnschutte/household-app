import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

/**
 * A stand-in for window.visualViewport, which no test DOM implements. It is the
 * browser standing in for itself: the keyboard that shrinks the visible region
 * on a phone cannot be reached from this test loop, so the fake reports the
 * band the browser would report and fires the event the browser would fire.
 */
class FakeVisualViewport extends EventTarget {
  constructor(
    public offsetTop = 0,
    public height = 800
  ) {
    super();
  }

  /** What iOS does on focus: shrink the visible band and scroll it down the page. */
  keyboardOpens({ offsetTop, height }: { offsetTop: number; height: number }) {
    this.offsetTop = offsetTop;
    this.height = height;
    act(() => {
      this.dispatchEvent(new Event("resize"));
    });
  }
}

function installViewport(viewport?: FakeVisualViewport) {
  Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
  return viewport;
}

afterEach(() => installViewport(undefined));

function renderDialog() {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Categorie aanmaken</DialogTitle>
      </DialogContent>
    </Dialog>
  );
  return screen.getByRole("dialog");
}

describe("DialogContent", () => {
  it("sits in the middle of the region the browser is showing", () => {
    installViewport(new FakeVisualViewport(0, 800));

    expect(renderDialog().style.top).toBe("400px");
  });

  it("moves with the keyboard rather than off the top of the screen", () => {
    const viewport = installViewport(new FakeVisualViewport(0, 800))!;
    const dialog = renderDialog();

    // Keyboard takes the bottom 500px, and the page scrolls 150px under it.
    viewport.keyboardOpens({ offsetTop: 150, height: 300 });

    expect(dialog.style.top).toBe("300px");
    expect(dialog.style.maxHeight).toBe("268px");
  });

  it("leaves the CSS centring alone where the browser cannot measure", () => {
    installViewport(undefined);

    expect(renderDialog().style.top).toBe("");
  });
});
