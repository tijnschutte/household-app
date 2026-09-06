import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StepEditor from "./step-editor";
import { withTrailingBlank } from "@/src/lib/recepten/recipe-form-lines";

function Harness({ initial }: { initial: string[] }) {
  const [steps, setSteps] = useState(() => withTrailingBlank(initial));
  return (
    <>
      <StepEditor steps={steps} onChange={setSteps} disabled={false} />
      <output>{JSON.stringify(steps)}</output>
    </>
  );
}

const stepsShown = () => JSON.parse(screen.getByRole("status").textContent ?? "[]") as string[];

describe("StepEditor", () => {
  it("always ends in one blank row to type the next step into", () => {
    render(<Harness initial={["Kook.", "Meng."]} />);

    expect(stepsShown()).toEqual(["Kook.", "Meng.", ""]);
    expect(screen.getByPlaceholderText("Volgende stap…")).toHaveValue("");
  });

  it("Enter on a step opens the next one and moves the caret there", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);

    await user.type(screen.getByLabelText("Stap 1"), "Kook de pasta.{Enter}Meng met pesto.");

    expect(stepsShown()).toEqual(["Kook de pasta.", "Meng met pesto.", ""]);
    expect(screen.getByLabelText("Stap 2")).toHaveFocus();
  });

  it("Enter in the middle inserts a step there, not at the end", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["Kook.", "Meng."]} />);

    await user.click(screen.getByLabelText("Stap 1"));
    await user.keyboard("{Enter}Roer.");

    expect(stepsShown()).toEqual(["Kook.", "Roer.", "Meng.", ""]);
    expect(screen.getByLabelText("Stap 2")).toHaveFocus();
  });

  it("Enter on an empty step does nothing, so a double Enter cannot leave a gap", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["Kook."]} />);

    await user.type(screen.getByLabelText("Stap 2"), "{Enter}{Enter}");

    expect(stepsShown()).toEqual(["Kook.", ""]);
  });

  it("Backspace on an empty step removes it and moves back to the previous one", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["Kook.", "Meng."]} />);

    await user.click(screen.getByLabelText("Stap 3"));
    await user.keyboard("{Backspace}");
    // Now on step 2 ("Meng.") — clear it, then Backspace once more removes the row.
    await user.clear(screen.getByLabelText("Stap 2"));
    await user.keyboard("{Backspace}");

    expect(stepsShown()).toEqual(["Kook.", ""]);
    expect(screen.getByLabelText("Stap 1")).toHaveFocus();
  });
});
