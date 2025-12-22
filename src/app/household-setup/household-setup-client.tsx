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
import { Loader2 } from "lucide-react";

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
      toast.error("Failed to create household");
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
      toast.error("Failed to join household");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Set Up Your Household
          </CardTitle>
          <CardDescription>
            Create a new household or join an existing one to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Household Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Create New Household</h3>
            <form className="space-y-4" onSubmit={handleCreateHousehold}>
              <div className="space-y-2">
                <Label htmlFor="household-name">Household Name</Label>
                <Input
                  id="household-name"
                  name="name"
                  placeholder="Enter household name (e.g., Smith Family)"
                  type="text"
                  required
                  disabled={isCreating}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Household"
                )}
              </Button>
            </form>
          </div>

          <div className="relative">
            <Separator />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              OR
            </div>
          </div>

          {/* Join Household Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Join Existing Household</h3>
            <form className="space-y-4" onSubmit={handleJoinHousehold}>
              <div className="space-y-2">
                <Label htmlFor="household-secret">Household Secret</Label>
                <Input
                  id="household-secret"
                  name="secret"
                  placeholder="Enter the household secret code"
                  type="text"
                  required
                  disabled={isJoining}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Ask a household member for the secret code
                </p>
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={isJoining}>
                {isJoining ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Household"
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
