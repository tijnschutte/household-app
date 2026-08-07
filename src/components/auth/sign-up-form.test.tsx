import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import SignUpForm from "./sign-up-form";
import { succeeds, fails } from "@/tests/fixtures/household";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * A stand-in for the signUp server action, recording the credentials it was
 * handed so a test can assert what reached the server — or that nothing did.
 */
function fakeSignUp(result: ActionResult = succeeds("Account succesvol aangemaakt")) {
  const calls: Array<{ username: string; password: string }> = [];
  return {
    calls,
    onSignUp: async (formData: FormData) => {
      calls.push({
        username: formData.get("username") as string,
        password: formData.get("password") as string,
      });
      return result;
    },
  };
}

function renderForm(result?: ActionResult) {
  const signUp = fakeSignUp(result);
  render(<SignUpForm onSignUp={signUp.onSignUp} />);
  return signUp;
}

async function submit(username: string, password: string) {
  if (username) await userEvent.type(screen.getByLabelText("Gebruikersnaam"), username);
  if (password) await userEvent.type(screen.getByLabelText("Wachtwoord"), password);
  await userEvent.click(screen.getByRole("button", { name: "Registreren" }));
}

describe("SignUpForm", () => {
  it("sends the credentials to the server when they are valid", async () => {
    const signUp = renderForm();

    await submit("tijn", "geheim");

    expect(signUp.calls).toEqual([{ username: "tijn", password: "geheim" }]);
  });

  it("logs the new account straight in and opens the app", async () => {
    renderForm();

    await submit("tijn", "geheim");

    expect(signIn).toHaveBeenCalledWith("credentials", {
      username: "tijn",
      password: "geheim",
      redirect: false,
    });
    expect(useRouter().push).toHaveBeenCalledWith("/");
  });

  it("sends the user to the login screen when the auto-login fails", async () => {
    vi.mocked(signIn).mockResolvedValue({ error: "CredentialsSignin" } as never);
    renderForm();

    await submit("tijn", "geheim");

    expect(useRouter().push).toHaveBeenCalledWith("/sign-in");
  });

  it("never tries to log in when the account was not created", async () => {
    renderForm(fails("Gebruikersnaam bestaat al"));

    await submit("tijn", "geheim");

    expect(signIn).not.toHaveBeenCalled();
    expect(useRouter().push).not.toHaveBeenCalled();
  });

  it("hides the password until the user asks to see it", async () => {
    renderForm();

    const password = screen.getByLabelText("Wachtwoord");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "" }));

    expect(screen.getByLabelText("Wachtwoord")).toHaveAttribute("type", "text");
  });

  describe("refusing credentials the server would reject anyway", () => {
    it("rejects a username with a space in it", async () => {
      const signUp = renderForm();

      await submit("ti jn", "geheim");

      expect(signUp.calls).toEqual([]);
    });

    it("rejects a password with a space in it", async () => {
      const signUp = renderForm();

      await submit("tijn", "ge heim");

      expect(signUp.calls).toEqual([]);
    });

    it("rejects a username shorter than three characters", async () => {
      const signUp = renderForm();

      await submit("ti", "geheim");

      expect(signUp.calls).toEqual([]);
    });

    it("rejects a password shorter than three characters", async () => {
      const signUp = renderForm();

      await submit("tijn", "ge");

      expect(signUp.calls).toEqual([]);
    });
  });

  it("lets the user try again when the name is already taken", async () => {
    const signUp = renderForm(fails("Gebruikersnaam bestaat al"));

    await submit("tijn", "geheim");

    expect(signUp.calls).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Registreren" })).toBeEnabled();
  });
});
