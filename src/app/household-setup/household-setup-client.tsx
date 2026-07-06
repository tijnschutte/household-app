"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import { createHousehold, joinHousehold } from "@/src/lib/actions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";

type SetupTab = "create" | "join";

// Mirrors the ViewToggle segmented control on the home screen (same sliding
// pill + role="tablist"/"tab" aria pattern), scoped locally since this is the
// only other place that needs it.
function SetupTabs({ tab, onChange }: { tab: SetupTab; onChange: (tab: SetupTab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Huishouden instellen"
      className="relative flex w-full rounded-lg bg-secondary p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-card shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: tab === "join" ? "translateX(100%)" : "translateX(0)" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={tab === "create"}
        onClick={() => onChange("create")}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors ${
          tab === "create" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        Nieuw huishouden
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "join"}
        onClick={() => onChange("join")}
        className={`relative z-10 flex h-11 flex-1 items-center justify-center rounded-md text-sm font-medium transition-colors ${
          tab === "join" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        Deelnemen
      </button>
    </div>
  );
}

export default function HouseholdSetupClient() {
  const router = useRouter();
  const [tab, setTab] = useState<SetupTab>("create");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreateHousehold = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await createHousehold(formData);

      if (result.success) {
        toast.success(result.message);
        router.push("/home");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error creating household:", error);
      toast.error("Aanmaken huishouden mislukt");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinHousehold = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsJoining(true);
    setJoinError(null);

    try {
      const formData = new FormData(e.currentTarget);
      // Normalize casing client-side before submit — the field displays
      // uppercase via CSS, but the actual value may still be lowercase.
      const rawSecret = (formData.get("secret") as string) ?? "";
      formData.set("secret", rawSecret.trim().toUpperCase());

      const result = await joinHousehold(formData);

      if (result.success) {
        toast.success(result.message);
        router.push("/home");
        router.refresh();
      } else {
        setJoinError(result.message);
      }
    } catch (error) {
      console.error("Error joining household:", error);
      setJoinError("Deelnemen aan huishouden mislukt");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end pb-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => signOut()}
            className="text-muted-foreground"
          >
            Uitloggen
          </Button>
        </div>
        <Card className="w-full p-6">
          <CardHeader className="space-y-1 p-0 pb-6">
            <CardTitle className="text-xl font-semibold">Stel je huishouden in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Maak een huishouden aan of doe mee met een bestaand huishouden.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 p-0">
            <SetupTabs tab={tab} onChange={setTab} />

            {tab === "create" ? (
              <form className="space-y-4" onSubmit={handleCreateHousehold}>
                <div className="space-y-2">
                  <Label htmlFor="household-name">Huishoudnaam</Label>
                  <Input
                    id="household-name"
                    name="name"
                    placeholder="bijv. Familie Jansen"
                    type="text"
                    required
                    disabled={isCreating}
                    className="h-12"
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aanmaken...
                    </>
                  ) : (
                    "Huishouden aanmaken"
                  )}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleJoinHousehold}>
                <div className="space-y-2">
                  <Label htmlFor="household-secret">Huishoudcode</Label>
                  <Input
                    id="household-secret"
                    name="secret"
                    placeholder="bijv. A1B2C3D4E5F6"
                    type="text"
                    required
                    disabled={isJoining}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={12}
                    aria-invalid={joinError ? true : undefined}
                    aria-describedby={joinError ? "household-secret-error" : undefined}
                    onChange={() => setJoinError(null)}
                    className="h-12 font-mono uppercase"
                  />
                  {joinError ? (
                    <p id="household-secret-error" className="text-xs text-destructive">
                      {joinError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Vraag de code aan een huishoudlid
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full h-12" disabled={isJoining}>
                  {isJoining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deelnemen...
                    </>
                  ) : (
                    "Deelnemen"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
