import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import HouseholdInfo from "./household-info";
import { aHousehold, succeeds, fails } from "@/tests/fixtures/household";
import type { ActionResult } from "@/src/lib/action-result";

function fakeLeave(result: ActionResult = succeeds("Huishouden succesvol verlaten")) {
  const calls: number[] = [];
  return {
    calls,
    onLeaveHousehold: async () => {
      calls.push(1);
      return result;
    },
  };
}

function renderInfo({ household = aHousehold(), userId = 1, leave = fakeLeave() } = {}) {
  render(
    <HouseholdInfo
      household={household}
      userId={userId}
      onLeaveHousehold={leave.onLeaveHousehold}
    />
  );
  return leave;
}

const confirmLeave = async () => {
  await userEvent.click(screen.getAllByRole("button", { name: /Huishouden verlaten/ })[0]);
  await userEvent.click(screen.getByRole("button", { name: "Huishouden verlaten" }));
};

describe("HouseholdInfo", () => {
  it("shows the household name and the code to share", () => {
    renderInfo({ household: aHousehold({ name: "Huize Zon", secret: "ZON123" }) });

    expect(screen.getByText("Huize Zon")).toBeInTheDocument();
    expect(screen.getByLabelText("Huishoudcode")).toHaveValue("ZON123");
  });

  it("lists the members and marks which one is you", () => {
    renderInfo({
      household: aHousehold({
        members: [
          { id: 1, name: "Tijn" },
          { id: 2, name: "Sam" },
        ],
      }),
      userId: 2,
    });

    expect(screen.getByText("Leden (2)")).toBeInTheDocument();
    expect(screen.getByText("Tijn")).toBeInTheDocument();
    // The "jij" badge sits in Sam's row, since Sam is the signed-in user.
    expect(screen.getByText("Sam").closest("li")).toHaveTextContent("jij");
    expect(screen.getByText("Tijn").closest("li")).not.toHaveTextContent("jij");
  });

  it("says N/A and refuses to copy when the household has no code", () => {
    renderInfo({ household: aHousehold({ secret: null }) });

    expect(screen.getByLabelText("Huishoudcode")).toHaveValue("N/A");
    expect(screen.getByRole("button", { name: "Huishoudcode kopiëren" })).toBeDisabled();
  });

  it("names the icon-only copy button, so a screen reader can find it", () => {
    renderInfo({ household: aHousehold({ secret: "ZON123" }) });

    expect(screen.getByRole("button", { name: "Huishoudcode kopiëren" })).toBeEnabled();
  });

  describe("leaving the household", () => {
    it("asks first, and does nothing until confirmed", async () => {
      const leave = renderInfo();

      await userEvent.click(screen.getAllByRole("button", { name: /Huishouden verlaten/ })[0]);

      expect(leave.calls).toEqual([]);
    });

    it("sends the user back to setup once they have left", async () => {
      const leave = renderInfo();

      await confirmLeave();

      expect(leave.calls).toEqual([1]);
      expect(useRouter().push).toHaveBeenCalledWith("/household-setup");
    });

    it("keeps the user where they are when leaving fails", async () => {
      const leave = renderInfo({ leave: fakeLeave(fails("Je zit niet in een huishouden")) });

      await confirmLeave();

      expect(leave.calls).toEqual([1]);
      expect(useRouter().push).not.toHaveBeenCalled();
    });

    it("does nothing when the user backs out", async () => {
      const leave = renderInfo();

      await userEvent.click(screen.getAllByRole("button", { name: /Huishouden verlaten/ })[0]);
      await userEvent.click(screen.getByRole("button", { name: "Annuleren" }));

      expect(leave.calls).toEqual([]);
    });
  });
});
