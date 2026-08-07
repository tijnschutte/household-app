/**
 * The push half of the service worker. next-pwa compiles this and imports it
 * into the generated `public/sw.js`, so the workbox caching it writes there
 * stays untouched — see `customWorkerSrc` in next.config.ts.
 *
 * This file runs in a worker, not a page: there is no window, no React and no
 * bundler alias at runtime. The only import is a type, erased at compile time,
 * and it is here so the payload this renders and the payload the server builds
 * cannot drift apart.
 */

import type { PushNotification } from "@/src/lib/notifications/topics";

declare const self: ServiceWorkerGlobalScope;

/**
 * The payload is encrypted with keys only our server holds, but it still
 * arrives from the network, and a push handler that throws shows the user the
 * browser's own "site updated in the background" notice instead of ours.
 */
function parseNotification(data: PushMessageData | null): PushNotification | null {
  if (!data) return null;
  try {
    const payload: unknown = data.json();
    if (typeof payload !== "object" || payload === null) return null;
    const { topic, title, body, url } = payload as Record<string, unknown>;
    if (typeof topic !== "string") return null;
    if (typeof title !== "string" || typeof body !== "string") return null;
    if (typeof url !== "string") return null;
    return { topic, title, body, url } as PushNotification;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const notification = parseNotification(event.data);
  if (!notification) return;

  // `renotify` ships in browsers but is missing from lib.webworker's
  // NotificationOptions; widened here rather than casting the whole literal,
  // which would stop checking the fields that are declared.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: notification.body,
    icon: "/icons/icon-192x192.png",
    // The topic is the tag, so five items added in a row collapse into one
    // row in the tray. `renotify` is what still buzzes for each of them —
    // a silently replaced notification is one the shopper never sees.
    tag: notification.topic,
    renotify: true,
    data: { url: notification.url },
  };

  event.waitUntil(self.registration.showNotification(notification.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string } | null)?.url ?? "/home";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reuse the installed app's own window if it is already open, rather
      // than stacking a second one behind the first every time.
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(target).catch(() => {
          // Some browsers refuse navigate() on a focused client; being on the
          // wrong tab of an app that did open is a good enough outcome.
        });
        return;
      }

      await self.clients.openWindow(target);
    })()
  );
});
