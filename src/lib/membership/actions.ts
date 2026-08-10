"use server";

import { after } from "next/server";
import db from "@/src/lib/db/db";
import { executeAction } from "@/src/lib/executeAction";
import { DomainError } from "@/src/lib/domain-error";
import { rejectingDuplicates } from "@/src/lib/db/duplicates";
import { requireUser } from "@/src/lib/session";
import { notifyHousehold } from "@/src/lib/notifications/notify";
import { memberJoined } from "@/src/lib/notifications/topics";

/**
 * Joining, leaving and founding a household. Everything here reports its
 * outcome as an ActionResult: each failure is a sentence the user has to read
 * ("Ongeldige huishoudcode"), and Next redacts the message of anything thrown
 * out of a server action.
 */

/** Length of the code a member reads out to someone joining. */
const SECRET_LENGTH = 12;

function generateSecret(): string {
  const randomString =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return randomString.slice(0, SECRET_LENGTH).toUpperCase();
}

export const createHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const { userId, householdId } = await requireUser();
      if (householdId != null) {
        throw new DomainError("Je zit al in een huishouden");
      }

      const name = (formData.get("name") as string)?.trim();
      if (!name) {
        throw new DomainError("Naam is vereist");
      }

      // The unique index is what actually decides the name is taken, so let it
      // decide: a findUnique first would still lose to another member creating
      // the same name in between the read and the write.
      return rejectingDuplicates(
        () =>
          db.household.create({
            data: {
              name,
              secret: generateSecret(),
              members: { connect: { id: userId } },
            },
          }),
        "Een huishouden met deze naam bestaat al. Kies een andere naam."
      );
    },
    successMessage: "Huishouden succesvol aangemaakt",
  });
};

export const joinHousehold = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const { userId, name: actorName, householdId } = await requireUser();
      if (householdId != null) {
        throw new DomainError("Je zit al in een huishouden");
      }

      const secret = formData.get("secret") as string;
      if (!secret) {
        throw new DomainError("Code is vereist");
      }

      // Read out loud and typed in by hand, so neither case nor stray spaces
      // are the user getting it wrong.
      const household = await db.household.findUnique({
        where: { secret: secret.trim().toUpperCase() },
      });
      if (!household) {
        throw new DomainError("Ongeldige huishoudcode");
      }

      await db.user.update({
        where: { id: userId },
        data: { householdId: household.id },
      });

      after(() =>
        notifyHousehold({
          householdId: household.id,
          actorUserId: userId,
          notification: memberJoined(actorName, household.name),
        })
      );

      return household;
    },
    successMessage: "Succesvol deelgenomen aan huishouden",
  });
};

export const leaveHousehold = async () => {
  return executeAction({
    actionFn: async () => {
      const { userId } = await requireUser();

      await db.user.update({
        where: { id: userId },
        data: { householdId: null },
      });
    },
    successMessage: "Huishouden succesvol verlaten",
  });
};
