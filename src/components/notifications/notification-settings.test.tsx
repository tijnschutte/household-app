import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationSettings from "./notification-settings";
import type { NotificationTopic } from "@/src/lib/notifications/topics";

/**
 * happy-dom has no service worker, so by default the device switch settles on
 * "this browser can't" here — which is exactly the branch a phone in Safari
 * hits, and worth pinning. `withASubscribedBrowser` supplies the other one.
 * The per-topic switches work either way: they are a person's preference, not
 * a device's.
 */

/** The key the component is configured with — see `env` in vitest.config.mts. */
const CURRENT_KEY = Uint8Array.from(atob("a-test-vapid-key".replace(/-/g, "+")), (c) =>
  c.charCodeAt(0)
);
const RETIRED_KEY = Uint8Array.from([9, 9, 9]);

/**
 * Stands in for a browser that already holds a push subscription, made against
 * `signedWith`. Subscribing again mints "…/fresh", so a test can tell a kept
 * subscription from a replaced one by which endpoint ends up registered.
 */
function withASubscribedBrowser({
  endpoint = "https://push.example/this-phone",
  signedWith = CURRENT_KEY,
}: { endpoint?: string; signedWith?: Uint8Array } = {}) {
  const unsubscribed: string[] = [];
  const asSubscription = (url: string, key: Uint8Array) => ({
    endpoint: url,
    options: { applicationServerKey: key.buffer },
    toJSON: () => ({ endpoint: url, keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: async () => void unsubscribed.push(url),
  });

  const registration = {
    pushManager: {
      getSubscription: async () => asSubscription(endpoint, signedWith),
      subscribe: async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) =>
        asSubscription("https://push.example/fresh", applicationServerKey),
    },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
  return { unsubscribed };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "PushManager");
});

function fakeMuting() {
  const saved: Array<{ topic: NotificationTopic; muted: boolean }> = [];
  return {
    saved,
    onSetTopicMuted: async (topic: NotificationTopic, muted: boolean) => {
      saved.push({ topic, muted });
    },
  };
}

function renderSettings({
  mutedTopics = [] as NotificationTopic[],
  onSetTopicMuted,
  onRegisterDevice = async () => {},
  onForgetDevice = async () => {},
}: {
  mutedTopics?: NotificationTopic[];
  onSetTopicMuted?: (topic: NotificationTopic, muted: boolean) => Promise<void>;
  onRegisterDevice?: (device: unknown) => Promise<void>;
  onForgetDevice?: (endpoint: string) => Promise<void>;
} = {}) {
  const muting = fakeMuting();
  render(
    <NotificationSettings
      mutedTopics={mutedTopics}
      onRegisterDevice={onRegisterDevice}
      onForgetDevice={onForgetDevice}
      onSetTopicMuted={onSetTopicMuted ?? muting.onSetTopicMuted}
    />
  );
  return muting;
}

const topicSwitch = (name: string) => screen.getByRole("switch", { name });

describe("NotificationSettings", () => {
  it("offers every topic, switched on unless the person muted it", () => {
    renderSettings({ mutedTopics: ["GROCERY_ADDED"] });

    expect(topicSwitch("Nieuwe boodschap")).not.toBeChecked();
    expect(topicSwitch("Nieuwe huisgenoot")).toBeChecked();
  });

  it("mutes a topic the person switches off", async () => {
    const muting = renderSettings();

    await userEvent.click(topicSwitch("Nieuwe boodschap"));

    expect(topicSwitch("Nieuwe boodschap")).not.toBeChecked();
    expect(muting.saved).toEqual([{ topic: "GROCERY_ADDED", muted: true }]);
  });

  it("unmutes a topic the person switches back on", async () => {
    const muting = renderSettings({ mutedTopics: ["MEMBER_JOINED"] });

    await userEvent.click(topicSwitch("Nieuwe huisgenoot"));

    expect(topicSwitch("Nieuwe huisgenoot")).toBeChecked();
    expect(muting.saved).toEqual([{ topic: "MEMBER_JOINED", muted: false }]);
  });

  it("puts the switch back when saving fails, so it never lies about what is stored", async () => {
    const reported = vi.spyOn(console, "error").mockImplementation(() => {});
    renderSettings({
      onSetTopicMuted: async () => {
        throw new Error("offline");
      },
    });

    await userEvent.click(topicSwitch("Nieuwe boodschap"));

    await waitFor(() => expect(topicSwitch("Nieuwe boodschap")).toBeChecked());
    expect(reported).toHaveBeenCalledWith(
      "Failed to save notification preference:",
      expect.any(Error)
    );
    reported.mockRestore();
  });

  it("disables the device switch when the browser cannot receive push at all", async () => {
    renderSettings();

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Meldingen op dit apparaat" })).toBeDisabled()
    );
  });

  describe("a browser that is already subscribed", () => {
    it("shows the device as on", async () => {
      withASubscribedBrowser();
      renderSettings();

      await waitFor(() =>
        expect(screen.getByRole("switch", { name: "Meldingen op dit apparaat" })).toBeChecked()
      );
    });

    it("re-registers it, so the server can never be the only one that forgot", async () => {
      const registered: unknown[] = [];
      withASubscribedBrowser({ endpoint: "https://push.example/tijns-phone" });
      renderSettings({ onRegisterDevice: async (device) => void registered.push(device) });

      await waitFor(() => expect(registered).toHaveLength(1));
      expect(registered[0]).toMatchObject({ endpoint: "https://push.example/tijns-phone" });
    });

    it("keeps a subscription that was made with the key still in use", async () => {
      const registered: unknown[] = [];
      const browser = withASubscribedBrowser({ endpoint: "https://push.example/tijns-phone" });
      renderSettings({ onRegisterDevice: async (device) => void registered.push(device) });

      await waitFor(() => expect(registered).toHaveLength(1));
      expect(registered[0]).toMatchObject({ endpoint: "https://push.example/tijns-phone" });
      expect(browser.unsubscribed).toEqual([]);
    });

    it("trades in a subscription signed with a retired key, so a rotation heals itself", async () => {
      const registered: unknown[] = [];
      const forgotten: string[] = [];
      const browser = withASubscribedBrowser({
        endpoint: "https://push.example/signed-with-the-old-key",
        signedWith: RETIRED_KEY,
      });
      renderSettings({
        onRegisterDevice: async (device) => void registered.push(device),
        onForgetDevice: async (endpoint) => void forgotten.push(endpoint),
      });

      await waitFor(() => expect(registered).toHaveLength(1));
      expect(registered[0]).toMatchObject({ endpoint: "https://push.example/fresh" });
      expect(forgotten).toEqual(["https://push.example/signed-with-the-old-key"]);
      expect(browser.unsubscribed).toEqual(["https://push.example/signed-with-the-old-key"]);
    });
  });
});
