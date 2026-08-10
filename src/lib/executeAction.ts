import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import type { ActionResult } from "@/src/lib/action-result";
import { DomainError } from "@/src/lib/domain-error";

type Options<T> = {
  actionFn: () => Promise<T>;
  successMessage?: string;
};

/**
 * Runs a server action and reports the outcome instead of throwing it.
 *
 * Which failures become a message is the whole point. A DomainError is one the
 * boundary declared and the user is meant to read, and a ZodError is the same
 * thing raised by a schema — both come back as `success: false` carrying their
 * own copy. Anything else is a bug, and rethrowing it is deliberate: a bug that
 * arrives as a polite Dutch sentence is a bug nobody investigates.
 */
const executeAction = async <T>({
  actionFn,
  successMessage = "Gelukt",
}: Options<T>): Promise<ActionResult<T>> => {
  try {
    const value = await actionFn();

    return { success: true, message: successMessage, value };
  } catch (error) {
    // redirect() reports itself by throwing; it is control flow, not a failure.
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof DomainError) {
      return { success: false, message: error.message };
    }

    // A schema is the boundary saying what it accepts, so failing one is
    // always expected. The first message is the one the field shows.
    if (error instanceof z.ZodError) {
      return { success: false, message: error.errors[0].message };
    }

    throw error;
  }
};

export { executeAction };
