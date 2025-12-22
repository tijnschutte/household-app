"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Household } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Separator } from "@/src/components/ui/separator";
import { Copy, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { leaveHousehold } from "@/src/lib/actions";

type HouseholdInfoProps = {
  household: Household;
  userId: number;
};

export default function HouseholdInfo({ household, userId }: HouseholdInfoProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const copySecret = async () => {
    if (household.secret) {
      await navigator.clipboard.writeText(household.secret);
      setCopied(true);
      toast.success("Secret copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeaveHousehold = async () => {
    setIsLeaving(true);
    try {
      const result = await leaveHousehold(userId);
      if (result.success) {
        toast.success(result.message);
        router.push("/household-setup");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error leaving household:", error);
      toast.error("Failed to leave household");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{household.name}</CardTitle>
        <CardDescription>
          Share the secret code below to invite others to your household
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="secret">Household Secret</Label>
          <div className="flex gap-2">
            <Input
              id="secret"
              value={household.secret || "N/A"}
              readOnly
              className="font-mono text-lg font-semibold"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={copySecret}
              disabled={!household.secret}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this code can join your household
          </p>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isLeaving}>
              <LogOut className="mr-2 h-4 w-4" />
              Leave Household
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove you from "{household.name}". You can rejoin later using the household secret code.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeaveHousehold} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Leave Household
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
