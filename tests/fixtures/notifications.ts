/**
 * Fakes for the notification boundary. The `Audience` here is a real
 * in-memory implementation of the contract, not a stub that replays answers:
 * a test states which devices exist and then asserts on what survived.
 */

import type { Audience } from "@/src/lib/notifications/audience";
import type { Device, DeliveryOutcome, PushSender } from "@/src/lib/notifications/push-sender";
import type { NotificationTopic, PushNotification } from "@/src/lib/notifications/topics";

export function aDevice(overrides: Partial<Device> = {}): Device {
  return {
    endpoint: "https://push.example/device-1",
    p256dh: "p256dh-key",
    auth: "auth-secret",
    ...overrides,
  };
}

export type FakeAudience = Audience & {
  /** The devices still known to the store — what `forget` actually removed. */
  remaining(): Device[];
  /** The topics the audience was asked about, to pin down who was consulted. */
  askedAbout: NotificationTopic[];
};

export function anAudience(devices: Device[]): FakeAudience {
  let store = [...devices];
  const askedAbout: NotificationTopic[] = [];

  return {
    askedAbout,
    remaining: () => store,
    async devicesFor(_householdId, _actorUserId, topic) {
      askedAbout.push(topic);
      return store;
    },
    async forget(endpoint) {
      store = store.filter((device) => device.endpoint !== endpoint);
    },
  };
}

export type FakeSender = PushSender & { delivered: PushNotification[] };

/**
 * A sender that reports `outcomeFor(endpoint)` — default "delivered" — and
 * records what actually went out.
 */
export function aSender(outcomeFor: (endpoint: string) => DeliveryOutcome = () => "delivered") {
  const delivered: PushNotification[] = [];
  const send = (async (device, notification) => {
    const outcome = outcomeFor(device.endpoint);
    if (outcome === "delivered") delivered.push(notification);
    return outcome;
  }) as FakeSender;
  send.delivered = delivered;
  return send;
}
