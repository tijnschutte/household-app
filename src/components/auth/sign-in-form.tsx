"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    // Client-side validation
    if (username.includes(" ")) {
      toast.error("Gebruikersnaam mag geen spaties bevatten");
      setIsPending(false);
      return;
    }
    if (password.includes(" ")) {
      toast.error("Wachtwoord mag geen spaties bevatten");
      setIsPending(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Ongeldige gebruikersnaam of wachtwoord");
      } else {
        router.push("/");
        router.refresh();
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
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Wachtwoord</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            placeholder="Voer je wachtwoord in"
            type={showPassword ? "text" : "password"}
            required
            maxLength={15}
            autoComplete="current-password"
            disabled={isPending}
            className="pr-10"
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
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inloggen"}
      </Button>
    </form>
  );
}
