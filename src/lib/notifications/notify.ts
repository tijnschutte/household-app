import { prismaAudience, type Audience } from "@/src/lib/notifications/audience";
import { webPushSender, type PushSender } from "@/src/lib/notifications/push-sender";
import type { PushNotification } from "@/src/lib/notifications/topics";

type Delivery = { audience: Audience; send: PushSender };

const production: Delivery = { audience: prismaAudience, send: webPushSender };

/**
 * Tells the rest of a household what one of its members just did.
 *
 * Never throws. A notification is the non-critical path — nobody should fail
 * to add bread because a push service was down — so every failure is absorbed
 * here rather than travelling back up into the action that raised the event.
 * Callers hand this to `after()` so delivery costs the request nothing.
 *
 * Devices the push service declares dead are forgotten as we go: a
 * subscription rots on reinstall or permission change, and nothing else in
 * the system would ever notice.
 */
export async function notifyHousehold(
  input: { householdId: number; actorUserId: number; notification: PushNotification },
  { audience, send }: Delivery = production
): Promise<void> {
  const { householdId, actorUserId, notification } = input;

  try {
    const devices = await audience.devicesFor(householdId, actorUserId, notification.topic);

    const outcomes = await Promise.all(
      devices.map(async (device) => ({ device, outcome: await send(device, notification) }))
    );

    await Promise.all(
      outcomes
        .filter(({ outcome }) => outcome === "gone")
        .map(({ device }) => audience.forget(device.endpoint))
    );
  } catch (error) {
    // Off the critical path, so isolate and log rather than crash — but log
    // loudly, because everything expected is already handled as an outcome
    // above and anything reaching here is a bug.
    console.error("Failed to notify household:", error);
  }
}
