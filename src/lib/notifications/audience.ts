import prisma from "@/src/lib/db/db";
import type { Device } from "@/src/lib/notifications/push-sender";
import type { NotificationTopic } from "@/src/lib/notifications/topics";

/**
 * Who a notification actually goes to. The contract notify.ts depends on, so
 * the delivery rules can be tested without a database.
 */
export type Audience = {
  /**
   * Every device belonging to a member of `householdId` who has not muted
   * `topic` — minus `actorUserId`, who is holding the phone that caused the
   * event and does not need telling.
   */
  devicesFor(householdId: number, actorUserId: number, topic: NotificationTopic): Promise<Device[]>;

  /** Drop a device the push service has declared dead. */
  forget(endpoint: string): Promise<void>;
};

export const prismaAudience: Audience = {
  devicesFor(householdId, actorUserId, topic) {
    return prisma.pushSubscription.findMany({
      where: {
        user: {
          householdId,
          id: { not: actorUserId },
          // No mute row is the default, so a topic added later reaches
          // everyone without a backfill.
          notificationMutes: { none: { topic } },
        },
      },
      select: { endpoint: true, p256dh: true, auth: true },
    });
  },

  async forget(endpoint) {
    // deleteMany, not delete: two pushes to the same dead endpoint can race,
    // and the second one losing is not an error worth raising.
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  },
};
