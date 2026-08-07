import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import HouseholdSetupClient from "./household-setup-client";
import { succeeds, fails } from "@/tests/fixtures/household";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * A stand-in for the two server actions. Both record the FormData they were
 * handed, so a test can assert on what the user's input became.
 */
function fakeActions({
  create = succeeds("Huishouden succesvol aangemaakt"),
  join = succeeds("Succesvol deelgenomen aan huishouden"),
}: { create?: ActionResult; join?: ActionResult } = {}) {
  const created: string[] = [];
  const joined: string[] = [];

  return {
    created,
    joined,
    onCreateHousehold: async (formData: FormData) => {
      created.push(formData.get("name") as string);
      return create;
    },
    onJoinHousehold: async (formData: FormData) => {
      joined.push(formData.get("secret") as string);
      return join;
    },
  };
}

function renderSetup(results?: Parameters<typeof fakeActions>[0]) {
  const actions = fakeActions(results);
  render(
    <HouseholdSetupClient
      onCreateHousehold={actions.onCreateHousehold}
      onJoinHousehold={actions.onJoinHousehold}
    />
  );
  return actions;
}

const switchToJoin = () => userEvent.click(screen.getByRole("tab", { name: "Deelnemen" }));

describe("HouseholdSetupClient", () => {
  it("offers to create a household first", () => {
    renderSetup();

    expect(screen.getByRole("tab", { name: "Nieuw huishouden" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Huishoudnaam")).toBeInTheDocument();
  });

  it("swaps to the join form when that tab is picked", async () => {
    renderSetup();

    await switchToJoin();

    expect(screen.getByLabelText("Huishoudcode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Huishoudnaam")).not.toBeInTheDocument();
  });

  describe("creating a household", () => {
    it("creates it under the typed name and moves on to the app", async () => {
      const actions = renderSetup();

      await userEvent.type(screen.getByLabelText("Huishoudnaam"), "Huize Zon");
      await userEvent.click(screen.getByRole("button", { name: "Huishouden aanmaken" }));

      expect(actions.created).toEqual(["Huize Zon"]);
      expect(useRouter().push).toHaveBeenCalledWith("/home");
    });

    it("stays put when the name is taken", async () => {
      renderSetup({ create: fails("Een huishouden met deze naam bestaat al.") });

      await userEvent.type(screen.getByLabelText("Huishoudnaam"), "Huize Zon");
      await userEvent.click(screen.getByRole("button", { name: "Huishouden aanmaken" }));

      expect(useRouter().push).not.toHaveBeenCalled();
    });
  });

  describe("joining a household", () => {
    it("normalizes the code, so a lowercase paste still works", async () => {
      const actions = renderSetup();

      await switchToJoin();
      await userEvent.type(screen.getByLabelText("Huishoudcode"), "  a1b2c3  ");
      await userEvent.click(screen.getByRole("button", { name: "Deelnemen" }));

      expect(actions.joined).toEqual(["A1B2C3"]);
      expect(useRouter().push).toHaveBeenCalledWith("/home");
    });

    it("shows a wrong code inline on the field rather than as a toast", async () => {
      renderSetup({ join: fails("Ongeldige huishoudcode") });

      await switchToJoin();
      await userEvent.type(screen.getByLabelText("Huishoudcode"), "NOPE");
      await userEvent.click(screen.getByRole("button", { name: "Deelnemen" }));

      const field = screen.getByLabelText("Huishoudcode");
      expect(screen.getByText("Ongeldige huishoudcode")).toBeInTheDocument();
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(useRouter().push).not.toHaveBeenCalled();
    });

    it("clears the error as soon as the user edits the code again", async () => {
      renderSetup({ join: fails("Ongeldige huishoudcode") });

      await switchToJoin();
      await userEvent.type(screen.getByLabelText("Huishoudcode"), "NOPE");
      await userEvent.click(screen.getByRole("button", { name: "Deelnemen" }));
      await userEvent.type(screen.getByLabelText("Huishoudcode"), "X");

      expect(screen.queryByText("Ongeldige huishoudcode")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Huishoudcode")).not.toHaveAttribute("aria-invalid");
    });
  });
});
