import { describe, expect, it, vi } from "vitest";
import { notifyHousehold } from "@/src/lib/notifications/notify";
import { groceryAdded } from "@/src/lib/notifications/topics";
import { aDevice, anAudience, aSender } from "@/tests/fixtures/notifications";

const bread = groceryAdded("Dirk", "brood");

const inTheHousehold = { householdId: 1, actorUserId: 2, notification: bread };

describe("notifyHousehold", () => {
  it("reaches every device the household has", async () => {
    const phone = aDevice({ endpoint: "https://push.example/phone" });
    const laptop = aDevice({ endpoint: "https://push.example/laptop" });
    const send = aSender();

    await notifyHousehold(inTheHousehold, { audience: anAudience([phone, laptop]), send });

    expect(send.delivered).toEqual([bread, bread]);
  });

  it("only asks for members who still want this notification's topic", async () => {
    const audience = anAudience([aDevice()]);

    await notifyHousehold(inTheHousehold, { audience, send: aSender() });

    expect(audience.askedAbout).toEqual(["GROCERY_ADDED"]);
  });

  it("forgets a device the push service says is gone", async () => {
    const dead = aDevice({ endpoint: "https://push.example/reinstalled" });
    const alive = aDevice({ endpoint: "https://push.example/phone" });
    const audience = anAudience([dead, alive]);

    await notifyHousehold(inTheHousehold, {
      audience,
      send: aSender((endpoint) => (endpoint === dead.endpoint ? "gone" : "delivered")),
    });

    expect(audience.remaining()).toEqual([alive]);
  });

  it("keeps a device whose delivery merely failed", async () => {
    const flaky = aDevice({ endpoint: "https://push.example/flaky" });
    const audience = anAudience([flaky]);

    await notifyHousehold(inTheHousehold, { audience, send: aSender(() => "failed") });

    expect(audience.remaining()).toEqual([flaky]);
  });

  it("stays silent when the whole boundary blows up, so the caller's write survives", async () => {
    const audience = anAudience([aDevice()]);
    audience.devicesFor = () => Promise.reject(new Error("database is down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyHousehold(inTheHousehold, { audience, send: aSender() })
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});
