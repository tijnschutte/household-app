import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import ModuleSettings from "./module-settings";
import type { OptionalModule } from "@/src/lib/modules/modules";

/**
 * A store standing in for the server's side of the choice: a test states what
 * is hidden and then asserts on what ended up hidden, rather than on which
 * calls were made to get there.
 */
function aServerThat({ fails = false } = {}) {
  const hidden = new Set<OptionalModule>();
  return {
    hidden,
    onSetModuleHidden: async (name: OptionalModule, isHidden: boolean) => {
      if (fails) throw new Error("nope");
      if (isHidden) hidden.add(name);
      else hidden.delete(name);
    },
  };
}

describe("ModuleSettings", () => {
  it("offers every optional module, switched on unless the person hid it", () => {
    render(<ModuleSettings hiddenModules={["GELD"]} {...aServerThat()} />);

    expect(screen.getByRole("switch", { name: "Geld" })).not.toBeChecked();
  });

  it("hides a module the person switches off", async () => {
    const server = aServerThat();
    render(<ModuleSettings hiddenModules={[]} {...server} />);

    await userEvent.click(screen.getByRole("switch", { name: "Geld" }));

    await waitFor(() => expect(server.hidden).toContain("GELD"));
    expect(screen.getByRole("switch", { name: "Geld" })).not.toBeChecked();
  });

  it("shows it again when the person switches it back on", async () => {
    const server = aServerThat();
    server.hidden.add("GELD");
    render(<ModuleSettings hiddenModules={["GELD"]} {...server} />);

    await userEvent.click(screen.getByRole("switch", { name: "Geld" }));

    await waitFor(() => expect(server.hidden).not.toContain("GELD"));
    expect(screen.getByRole("switch", { name: "Geld" })).toBeChecked();
  });

  it("puts the switch back when saving fails, so it never lies about what is stored", async () => {
    render(<ModuleSettings hiddenModules={[]} {...aServerThat({ fails: true })} />);

    await userEvent.click(screen.getByRole("switch", { name: "Geld" }));

    await waitFor(() => expect(screen.getByRole("switch", { name: "Geld" })).toBeChecked());
  });

  it("asks for a re-render, because the bar it changes lives in the layout", async () => {
    // The bar is rendered by the tabs layout, which a state change in this card
    // does not reach. Without this the switch moves and the bar does not, until
    // the next full page load.
    render(<ModuleSettings hiddenModules={[]} {...aServerThat()} />);

    await userEvent.click(screen.getByRole("switch", { name: "Geld" }));

    await waitFor(() => expect(vi.mocked(useRouter()).refresh).toHaveBeenCalled());
  });
});
