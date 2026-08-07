import webpush, { WebPushError } from "web-push";
import type { PushNotification } from "@/src/lib/notifications/topics";

/** One device's push endpoint and its encryption keys, as the browser gave them. */
export type Device = { endpoint: string; p256dh: string; auth: string };

/**
 * What delivery said about the *device*, not about the message. "gone" is the
 * push service telling us this endpoint will never work again — the browser
 * was reinstalled, the permission revoked, the subscription rotated — and is
 * the only outcome the caller must act on, by forgetting the device.
 */
export type DeliveryOutcome = "delivered" | "gone" | "failed";

/**
 * The contract notify.ts depends on. A function, not an interface: there is
 * one operation, and a test wants to hand over a fake in one line.
 */
export type PushSender = (
  device: Device,
  notification: PushNotification
) => Promise<DeliveryOutcome>;

// A grocery notification is worth nothing the next morning; don't let a push
// service hold it for its multi-day default while a phone is off.
const TTL_SECONDS = 6 * 60 * 60;

// The push service reports an endpoint it will never accept again with one of
// these. Anything else is this request failing, not this device dying.
const DEVICE_IS_GONE = new Set([404, 410]);

type Vapid = { subject: string; publicKey: string; privateKey: string };

let vapid: Vapid | null | undefined;

/**
 * Reads the VAPID keys once. Returns null — and says so once — when they are
 * absent, which is the normal state of a fresh clone: notifications are the
 * non-critical path, so a missing key must not take the app down with it.
 */
function vapidKeys(): Vapid | null {
  if (vapid !== undefined) return vapid;

  const subject = process.env.VAPID_SUBJECT;
  // Deliberately the same variable the browser reads: the public key is public
  // by definition, and a second copy is a second thing that can drift.
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    console.warn(
      "Push notifications are off: set VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY and " +
        "VAPID_PRIVATE_KEY (generate the pair with `bunx web-push generate-vapid-keys`)."
    );
    vapid = null;
    return null;
  }

  vapid = { subject, publicKey, privateKey };
  return vapid;
}

export const webPushSender: PushSender = async (device, notification) => {
  const keys = vapidKeys();
  if (!keys) return "failed";

  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(notification),
      {
        TTL: TTL_SECONDS,
        vapidDetails: {
          subject: keys.subject,
          publicKey: keys.publicKey,
          privateKey: keys.privateKey,
        },
      }
    );
    return "delivered";
  } catch (error) {
    if (error instanceof WebPushError) {
      if (DEVICE_IS_GONE.has(error.statusCode)) return "gone";
      console.error(`Push rejected with ${error.statusCode}: ${error.body}`);
      return "failed";
    }
    // Not the push service answering — DNS, TLS, a bug in the payload we built.
    console.error("Push delivery threw:", error);
    return "failed";
  }
};
