"use server";

import { z } from "zod";
import { NotificationTopic } from "@prisma/client";
import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";

/**
 * Everything the notification settings screen can do. Each export here is a
 * POST endpoint anyone signed in can call, so the user is taken from the
 * session and never from an argument.
 */

// What `PushSubscription.toJSON()` gives us in the browser. It arrives over the
// wire as untyped JSON, and the endpoint is a URL this server will later make
// requests to — so it is parsed, https-only and length-capped, not trusted.
const deviceSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(200),
  }),
});

const topicSchema = z.nativeEnum(NotificationTopic);

/**
 * Registers the device the caller is holding. Keyed on the endpoint, which the
 * push service guarantees unique per device, so re-granting permission on a
 * phone that already had it refreshes its keys instead of adding a row — and
 * a shared device moves to whoever signed in last.
 */
export async function registerDevice(rawDevice: unknown): Promise<void> {
  const { userId } = await requireUser();
  const device = deviceSchema.parse(rawDevice);

  await prisma.pushSubscription.upsert({
    where: { endpoint: device.endpoint },
    create: {
      userId,
      endpoint: device.endpoint,
      p256dh: device.keys.p256dh,
      auth: device.keys.auth,
    },
    update: { userId, p256dh: device.keys.p256dh, auth: device.keys.auth },
  });
}

/** Switches notifications off for the device the caller is holding. */
export async function forgetDevice(endpoint: string): Promise<void> {
  const { userId } = await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

/** The topics this user has switched off. Absence means they want the topic. */
export async function getMutedTopics(): Promise<NotificationTopic[]> {
  const { userId } = await requireUser();
  const mutes = await prisma.notificationMute.findMany({
    where: { userId },
    select: { topic: true },
  });
  return mutes.map((mute) => mute.topic);
}

/** One person's choice about one topic; it applies to all of their devices. */
export async function setTopicMuted(rawTopic: unknown, muted: boolean): Promise<void> {
  const { userId } = await requireUser();
  const topic = topicSchema.parse(rawTopic);

  if (muted) {
    await prisma.notificationMute.upsert({
      where: { userId_topic: { userId, topic } },
      create: { userId, topic },
      update: {},
    });
  } else {
    await prisma.notificationMute.deleteMany({ where: { userId, topic } });
  }
}
