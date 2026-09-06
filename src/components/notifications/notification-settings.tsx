"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Separator } from "@/src/components/ui/separator";
import { Switch } from "@/src/components/ui/switch";
import { NOTIFICATION_TOPICS, type NotificationTopic } from "@/src/lib/notifications/topics";
import {
  currentSubscription,
  pushSupport,
  signedWithCurrentKey,
  subscribeThisDevice,
  type PushSupport,
} from "@/src/lib/notifications/push-device";

/**
 * The three operations this card needs, owned here rather than imported from
 * the action module: the server page passes the real server actions in, and a
 * test passes fakes. Keeps Prisma out of anything that renders this.
 */
export type NotificationSettingsActions = {
  onRegisterDevice: (device: unknown) => Promise<void>;
  onForgetDevice: (endpoint: string) => Promise<void>;
  onSetTopicMuted: (topic: NotificationTopic, muted: boolean) => Promise<void>;
};

type NotificationSettingsProps = {
  /** The topics this person has switched off; everything else is on. */
  mutedTopics: NotificationTopic[];
} & NotificationSettingsActions;

/**
 * What the device switch shows: still finding out, one of the reasons push
 * can't work here (see PushSupport), or whether this device is subscribed.
 */
type DeviceState = "checking" | Exclude<PushSupport, "supported"> | "off" | "on";

export default function NotificationSettings({
  mutedTopics,
  onRegisterDevice,
  onForgetDevice,
  onSetTopicMuted,
}: NotificationSettingsProps) {
  const [device, setDevice] = useState<DeviceState>("checking");
  const [switchingDevice, setSwitchingDevice] = useState(false);
  const [muted, setMuted] = useState(() => new Set(mutedTopics));

  // Feature-detection reads navigator and window, so it belongs in an effect:
  // the server render has neither, and guessing produces a hydration mismatch.
  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      const support = pushSupport();
      if (support !== "supported") {
        if (!cancelled) setDevice(support);
        return;
      }
      let existing = await currentSubscription();
      if (cancelled) return;

      // A subscription signed against a retired key can never be pushed to
      // again. Permission is already granted, so trading it for a fresh one
      // needs no gesture and nobody has to notice a rotation happened.
      if (existing && !signedWithCurrentKey(existing)) {
        await onForgetDevice(existing.endpoint);
        await existing.unsubscribe();
        existing = await subscribeThisDevice();
      }

      // The browser is the source of truth for whether this device is
      // subscribed; the row on the server is a copy of that. Re-registering
      // what we find (an idempotent upsert) is what stops the two drifting
      // into the one state the user cannot see or fix: a switch that reads
      // "on" while the server has no way to reach them.
      if (existing) await onRegisterDevice(existing.toJSON());
      if (!cancelled) setDevice(existing ? "on" : "off");
    };

    detect().catch(() => {
      if (!cancelled) setDevice("unsupported");
    });

    return () => {
      cancelled = true;
    };
    // Runs once on mount: the server action prop is stable, and re-running
    // this would re-register the device on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchDevice = async (on: boolean) => {
    setSwitchingDevice(true);
    try {
      if (!on) {
        const existing = await currentSubscription();
        if (existing) {
          await onForgetDevice(existing.endpoint);
          await existing.unsubscribe();
        }
        setDevice("off");
        return;
      }

      // Must run inside the click that got us here: browsers only accept a
      // permission prompt raised by a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(
          permission === "denied"
            ? "Meldingen staan uit in je browserinstellingen"
            : "Meldingen niet toegestaan"
        );
        return;
      }

      const subscription = await subscribeThisDevice();
      await onRegisterDevice(subscription.toJSON());
      setDevice("on");
      toast.success("Meldingen staan aan op dit apparaat");
    } catch (error) {
      console.error("Failed to switch notifications:", error);
      toast.error("Meldingen aanzetten mislukt");
    } finally {
      setSwitchingDevice(false);
    }
  };

  const switchTopic = async (topic: NotificationTopic, wanted: boolean) => {
    // Optimistic: flip locally, revert on failure. Same pattern as checking an
    // item off the list.
    const apply = (isMuted: boolean) =>
      setMuted((previous) => {
        const next = new Set(previous);
        if (isMuted) next.add(topic);
        else next.delete(topic);
        return next;
      });

    apply(!wanted);
    try {
      await onSetTopicMuted(topic, !wanted);
    } catch (error) {
      apply(wanted);
      console.error("Failed to save notification preference:", error);
      toast.error("Opslaan mislukt");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Meldingen
        </CardTitle>
        <CardDescription>
          Kies waarover je een melding krijgt. Deze keuze geldt voor al je apparaten.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Meldingen op dit apparaat</p>
            <p className="text-sm text-muted-foreground">
              {device === "needs-install"
                ? "Zet Mandje eerst op je beginscherm: deel-knop → Zet op beginscherm."
                : device === "unsupported"
                  ? "Deze browser ondersteunt geen meldingen."
                  : "Alleen dit apparaat; zet het per apparaat aan."}
            </p>
          </div>
          {switchingDevice ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              aria-label="Meldingen op dit apparaat"
              checked={device === "on"}
              disabled={
                device === "checking" || device === "unsupported" || device === "needs-install"
              }
              onCheckedChange={switchDevice}
            />
          )}
        </div>

        <Separator />

        {Object.entries(NOTIFICATION_TOPICS).map(([key, topic]) => {
          const name = key as NotificationTopic;
          return (
            <div key={name} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{topic.label}</p>
                <p className="text-sm text-muted-foreground">{topic.description}</p>
              </div>
              <Switch
                aria-label={topic.label}
                checked={!muted.has(name)}
                onCheckedChange={(wanted) => switchTopic(name, wanted)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
