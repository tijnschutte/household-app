/**
 * This browser's side of Web Push: whether it can receive a push at all, and
 * the one subscription it holds for us. Everything here reads `navigator` and
 * `window`, so it is for the client and never runs during a server render.
 *
 * The server's half — sending, and the rows that remember each device — lives
 * in push-sender.ts and audience.ts, which a screen must never import.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * Why this device can't receive notifications, when it can't. "needs-install"
 * is the one worth explaining: iOS grants Web Push only to a PWA that has been
 * added to the home screen, so a user in Safari sees a fixable instruction
 * rather than a dead switch.
 */
export type PushSupport = "supported" | "unsupported" | "needs-install";

export function pushSupport(): PushSupport {
  if (VAPID_PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window) {
    return "supported";
  }
  return isIosSafariInATab() ? "needs-install" : "unsupported";
}

function isIosSafariInATab(): boolean {
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  return iOS && !window.matchMedia("(display-mode: standalone)").matches;
}

/** The subscription this browser already holds for us, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Asks the browser for a subscription signed with the key this server pushes
 * with. Prompts for permission unless it was already granted, so a first call
 * has to come from a user gesture.
 */
export async function subscribeThisDevice(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey(),
  });
}

/**
 * Whether a subscription was made against the key this server still signs
 * with. After the VAPID pair is rotated, every existing subscription keeps
 * working from the browser's point of view but the push service rejects our
 * pushes to it — a silence nobody is told about, on both ends. Comparing the
 * keys is the only way to notice.
 */
export function signedWithCurrentKey(subscription: PushSubscription): boolean {
  const used = subscription.options.applicationServerKey;
  if (!used) return false;
  const current = serverKey();
  const bytes = new Uint8Array(used);
  return bytes.length === current.length && bytes.every((byte, i) => byte === current[i]);
}

function serverKey(): Uint8Array {
  // Unreachable once pushSupport() said "supported"; loud rather than a silent
  // subscription nobody can push to.
  if (!VAPID_PUBLIC_KEY) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
  return decodeVapidKey(VAPID_PUBLIC_KEY);
}

/**
 * The VAPID key travels as URL-safe base64, but `pushManager.subscribe` wants
 * the raw bytes.
 */
function decodeVapidKey(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
