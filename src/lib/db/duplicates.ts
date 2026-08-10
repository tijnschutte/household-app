import { Prisma } from "@prisma/client";
import { DomainError } from "@/src/lib/domain-error";

/**
 * Runs a write whose unique constraint the user can trip by hand — typing a
 * name that is already on the list, paying a month that is already paid — and
 * reports that collision as copy they can act on, rather than a Prisma error
 * code.
 *
 * The constraint is what actually decides a row is a duplicate, so this reads
 * the answer off the failed write instead of a SELECT beforehand: a check-then-
 * write would still lose to the other member doing the same thing at the same
 * moment.
 */
export async function rejectingDuplicates<T>(write: () => Promise<T>, message: string): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError(message);
    }
    throw error;
  }
}
