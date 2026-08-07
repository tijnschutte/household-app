import type { NotificationTopic } from "@prisma/client";

/**
 * The notification topics, as values a client component can name, plus the
 * copy each one shows — in the settings screen and in the notification itself.
 *
 * Adding a topic is meant to be one edit in one file: the catalogue below and
 * its builder are what the settings screen renders and what the push carries,
 * so a topic can't ship half-described. Prisma's enum is imported as a *type*
 * only — importing it as a value drags Prisma's browser runtime into whatever
 * bundle does it (see recurring-kind.ts, same trade).
 */

/** What a member has to say yes to. Absence of a mute row means yes. */
export const NOTIFICATION_TOPICS = {
  GROCERY_ADDED: {
    label: "Nieuwe boodschap",
    description: "Als een huisgenoot iets aan de gedeelde lijst toevoegt",
  },
  MEMBER_JOINED: {
    label: "Nieuwe huisgenoot",
    description: "Als iemand lid wordt van je huishouden",
  },
  // Tripwire: Record demands a key per topic in the schema, so adding one to
  // the enum stops this compiling rather than silently shipping a topic that
  // nobody can switch off.
} as const satisfies Record<NotificationTopic, { label: string; description: string }>;

export const ALL_TOPICS = Object.keys(NOTIFICATION_TOPICS) as NotificationTopic[];

/**
 * What the service worker receives and renders. `topic` doubles as the
 * notification tag, so a second push on the same topic replaces the first in
 * the tray instead of stacking — five items added in a row is one entry.
 */
export type PushNotification = {
  topic: NotificationTopic;
  title: string;
  body: string;
  /** Where tapping the notification lands. */
  url: string;
};

// Item names are stored lowercase and capitalized by CSS in the list; a
// notification body has no CSS to do it.
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function groceryAdded(actorName: string, itemName: string): PushNotification {
  return {
    topic: "GROCERY_ADDED",
    title: "Boodschappen",
    body: `${actorName} voegde ${capitalize(itemName)} toe`,
    url: "/home",
  };
}

export function memberJoined(actorName: string, householdName: string): PushNotification {
  return {
    topic: "MEMBER_JOINED",
    title: "Huishouden",
    body: `${actorName} is bij ${householdName} gekomen`,
    url: "/huis",
  };
}

export type { NotificationTopic };
