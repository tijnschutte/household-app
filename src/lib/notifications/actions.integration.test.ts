/**
 * Notification settings belong to a person, not to a device or a household.
 *
 * Both a device endpoint and a topic arrive as arguments from the browser, so
 * every write here has to pin them to the session's user — otherwise one
 * housemate can unsubscribe another's phone.
 */

import { describe, expect, it } from "vitest";
import db from "@/src/lib/db/db";
import {
  forgetDevice,
  getMutedTopics,
  registerDevice,
  setTopicMuted,
} from "@/src/lib/notifications/actions";
import { aHouseholdWith } from "@/tests/integration/factories";
import { signInAs } from "@/tests/integration/session";

const A_DEVICE = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "a-public-key", auth: "an-auth-secret" },
};

describe("registerDevice", () => {
  it("stores the subscription against the caller", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await registerDevice(A_DEVICE);

    expect(
      await db.pushSubscription.findUnique({ where: { endpoint: A_DEVICE.endpoint } })
    ).toMatchObject({ userId: member.id, p256dh: "a-public-key" });
  });

  it("refreshes the keys instead of adding a row when a phone re-subscribes", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await registerDevice(A_DEVICE);
    await registerDevice({ ...A_DEVICE, keys: { p256dh: "rotated", auth: "rotated-auth" } });

    expect(await db.pushSubscription.count()).toBe(1);
    expect(
      await db.pushSubscription.findUnique({ where: { endpoint: A_DEVICE.endpoint } })
    ).toMatchObject({ p256dh: "rotated" });
  });

  it("moves a shared device to whoever signed in last", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });

    signInAs(member);
    await registerDevice(A_DEVICE);
    signInAs(housemate);
    await registerDevice(A_DEVICE);

    expect(
      await db.pushSubscription.findUnique({ where: { endpoint: A_DEVICE.endpoint } })
    ).toMatchObject({ userId: housemate.id });
  });

  it("refuses an endpoint this server would later make a request to over http", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    await expect(
      registerDevice({ ...A_DEVICE, endpoint: "http://push.example.com/abc" })
    ).rejects.toThrow();
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("refuses a payload that is not a subscription at all", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    await expect(registerDevice({ endpoint: "https://push.example.com/abc" })).rejects.toThrow();
  });
});

describe("forgetDevice", () => {
  it("switches off the caller's own device", async () => {
    const { member } = await aHouseholdWith("sam");
    await db.pushSubscription.create({
      data: { userId: member.id, endpoint: A_DEVICE.endpoint, p256dh: "k", auth: "a" },
    });

    signInAs(member);
    await forgetDevice(A_DEVICE.endpoint);

    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("leaves a housemate's device subscribed", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });
    await db.pushSubscription.create({
      data: { userId: housemate.id, endpoint: A_DEVICE.endpoint, p256dh: "k", auth: "a" },
    });

    signInAs(member);
    await forgetDevice(A_DEVICE.endpoint);

    expect(await db.pushSubscription.count()).toBe(1);
  });
});

describe("muting topics", () => {
  it("stores a mute for the caller and reads it back", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setTopicMuted("GROCERY_ADDED", true);

    expect(await getMutedTopics()).toEqual(["GROCERY_ADDED"]);
  });

  it("unmuting removes the row, because no row is the default", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setTopicMuted("GROCERY_ADDED", true);
    await setTopicMuted("GROCERY_ADDED", false);

    expect(await getMutedTopics()).toEqual([]);
    expect(await db.notificationMute.count()).toBe(0);
  });

  it("muting twice is not an error and does not add a second row", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);
    await setTopicMuted("GROCERY_ADDED", true);
    await setTopicMuted("GROCERY_ADDED", true);

    expect(await db.notificationMute.count()).toBe(1);
  });

  it("does not mute anything for a housemate", async () => {
    const { household, member } = await aHouseholdWith("sam");
    const housemate = await db.user.create({
      data: { name: "robin", householdId: household.id, password: "hashed" },
    });

    signInAs(member);
    await setTopicMuted("GROCERY_ADDED", true);

    signInAs(housemate);
    expect(await getMutedTopics()).toEqual([]);
  });

  it("refuses a topic that is not in the schema", async () => {
    const { member } = await aHouseholdWith("sam");

    signInAs(member);

    await expect(setTopicMuted("DROP TABLE", true)).rejects.toThrow();
    expect(await db.notificationMute.count()).toBe(0);
  });
});
