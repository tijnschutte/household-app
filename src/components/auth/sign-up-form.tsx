"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signUpSchema } from "@/src/lib/account/schema";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * The one operation this form needs, owned here rather than imported from the
 * action module: the server page passes the real server action in, and a test
 * passes a fake. Keeps Prisma out of anything that renders this.
 */
export type SignUpFormActions = {
  onSignUp: (formData: FormData) => Promise<ActionResult>;
};

export default function SignUpForm({ onSignUp }: SignUpFormActions) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    // Same schema the server action parses, so the two can't drift apart.
    const credentials = signUpSchema.safeParse({ username, password });
    if (!credentials.success) {
      toast.error(credentials.error.errors[0].message);
      setIsPending(false);
      return;
    }

    try {
      const result = await onSignUp(formData);

      if (result.success) {
        // Auto-login after successful sign-up
        const signInResult = await signIn("credentials", {
          username,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          toast.error("Account aangemaakt, maar inloggen mislukt");
          router.push("/sign-in");
        } else {
          toast.success("Account succesvol aangemaakt");
          router.push("/");
          router.refresh();
        }
      } else {
        toast.error(result.message || "Registratie mislukt");
      }
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="username">Gebruikersnaam</Label>
        <Input
          id="username"
          name="username"
          placeholder="Voer je gebruikersnaam in"
          type="text"
          required
          maxLength={15}
          autoComplete="username"
          disabled={isPending}
          className="h-12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Wachtwoord</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            placeholder="Maak een wachtwoord aan"
            type={showPassword ? "text" : "password"}
            required
            maxLength={72}
            autoComplete="new-password"
            disabled={isPending}
            className="h-12 pr-10"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowPassword(!showPassword);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              setShowPassword(!showPassword);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button className="w-full h-12" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registreren"}
      </Button>
    </form>
  );
}
