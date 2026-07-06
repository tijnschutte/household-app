"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HouseholdWithMembers } from "@/src/lib/data";
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
import { Badge } from "@/src/components/ui/badge";
import { Copy, Check, LogOut, Share2 } from "lucide-react";
import { toast } from "sonner";
import { leaveHousehold } from "@/src/lib/actions";

type HouseholdInfoProps = {
  household: HouseholdWithMembers;
  userId: number;
};

export default function HouseholdInfo({ household, userId }: HouseholdInfoProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [canShare, setCanShare] = useState(false);

  // Feature-detect navigator.share in an effect (not render) to avoid a
  // server/client hydration mismatch, since navigator is unavailable on
  // the server and unsupported in most desktop browsers.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const copySecret = async () => {
    if (household.secret) {
      await navigator.clipboard.writeText(household.secret);
      setCopied(true);
      toast.success("Code gekopieerd");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareSecret = async () => {
    if (!household.secret) return;
    try {
      await navigator.share({
        text: `Doe mee met "${household.name}" in Mandje met code ${household.secret}`,
      });
    } catch (error) {
      // AbortError when the user cancels the share sheet — not a real error.
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Error sharing household code:", error);
        toast.error("Delen mislukt");
      }
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
      toast.error("Verlaten huishouden mislukt");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{household.name}</CardTitle>
        <CardDescription>
          Deel de code hieronder om anderen uit te nodigen voor je huishouden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Leden ({household.members.length})</Label>
          <ul className="space-y-2">
            {household.members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm">{member.name}</span>
                {member.id === userId && <Badge variant="secondary">jij</Badge>}
              </li>
            ))}
          </ul>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="secret">Huishoudcode</Label>
          <div className="flex items-center gap-2">
            <Input
              id="secret"
              value={household.secret || "N/A"}
              readOnly
              className="h-12 font-mono text-lg font-semibold"
            />
            <Button size="icon" variant="outline" onClick={copySecret} disabled={!household.secret}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            {canShare && (
              <Button
                size="icon"
                variant="outline"
                onClick={shareSecret}
                disabled={!household.secret}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Iedereen met deze code kan deelnemen aan je huishouden
          </p>
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isLeaving}>
              <LogOut className="mr-2 h-4 w-4" />
              Huishouden verlaten
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
              <AlertDialogDescription>
                Dit verwijdert je uit &quot;{household.name}&quot;. Je kunt later opnieuw deelnemen
                met de huishoudcode.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLeaveHousehold}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Huishouden verlaten
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
