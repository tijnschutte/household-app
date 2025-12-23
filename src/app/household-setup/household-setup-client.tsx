"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Separator } from "@/src/components/ui/separator";
import { createHousehold, joinHousehold } from "@/src/lib/actions";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

type HouseholdSetupClientProps = {
  userId: string;
};

export default function HouseholdSetupClient({ userId }: HouseholdSetupClientProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateHousehold = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.append("userId", userId);

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

    try {
      const formData = new FormData(e.currentTarget);
      formData.append("userId", userId);

      const result = await joinHousehold(formData);

      if (result.success) {
        toast.success(result.message);
        router.push("/home");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error joining household:", error);
      toast.error("Deelnemen aan huishouden mislukt");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-2xl relative">
        <div className="absolute top-0 left-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Stel je huishouden in
            </CardTitle>
            <CardDescription>
              Maak een nieuw huishouden aan of neem deel aan een bestaand huishouden om te beginnen
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Household Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Nieuw huishouden maken</h3>
            <form className="space-y-4" onSubmit={handleCreateHousehold}>
              <div className="space-y-2">
                <Label htmlFor="household-name">Huishoudnaam</Label>
                <Input
                  id="household-name"
                  name="name"
                  placeholder="Voer huishoudnaam in (bijv. Familie Jansen)"
                  type="text"
                  required
                  disabled={isCreating}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
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
          </div>

          <div className="relative">
            <Separator />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              OF
            </div>
          </div>

          {/* Join Household Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Deelnemen aan bestaand huishouden</h3>
            <form className="space-y-4" onSubmit={handleJoinHousehold}>
              <div className="space-y-2">
                <Label htmlFor="household-secret">Huishoudcode</Label>
                <Input
                  id="household-secret"
                  name="secret"
                  placeholder="Voer de huishoudcode in"
                  type="text"
                  required
                  disabled={isJoining}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Vraag de code aan een huishoudlid
                </p>
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={isJoining}>
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
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
