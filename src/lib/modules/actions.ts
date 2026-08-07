"use server";

import { z } from "zod";
import { OptionalModule } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/db/db";
import { requireUser } from "@/src/lib/session";

/**
 * Reading and writing which tabs a person has switched off. The user comes
 * from the session, never from an argument: this is a POST endpoint anyone
 * signed in can call.
 */

const moduleSchema = z.nativeEnum(OptionalModule);

/**
 * The modules this person hid. Absence of a row means visible.
 *
 * A caller without a session gets an empty list rather than an error. The tab
 * bar lives in a layout, which Next renders alongside a page that is still
 * deciding to redirect to sign-in — so "nobody is signed in" is a state this
 * legitimately renders in, not a bug worth crashing the shell over.
 */
export async function getHiddenModules(): Promise<OptionalModule[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const hidden = await prisma.hiddenModule.findMany({
    where: { userId: Number(session.user.id) },
    select: { module: true },
  });
  return hidden.map((row) => row.module);
}

/** One person's choice about one tab; it applies to all of their devices. */
export async function setModuleHidden(rawModule: unknown, hidden: boolean): Promise<void> {
  const { userId } = await requireUser();
  // Not named `module`: Next reserves that identifier in application code.
  const chosen = moduleSchema.parse(rawModule);

  if (hidden) {
    await prisma.hiddenModule.upsert({
      where: { userId_module: { userId, module: chosen } },
      create: { userId, module: chosen },
      update: {},
    });
  } else {
    await prisma.hiddenModule.deleteMany({ where: { userId, module: chosen } });
  }
}
