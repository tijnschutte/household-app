import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { ActionResult } from "@/src/lib/action-result";

type Options<T> = {
  actionFn: () => Promise<T>;
  successMessage?: string;
};

const executeAction = async <T>({
  actionFn,
  successMessage = "The actions was successful",
}: Options<T>): Promise<ActionResult> => {
  try {
    await actionFn();

    return {
      success: true,
      message: successMessage,
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("executeAction error:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "An error has occurred during executing the action",
    };
  }
};

export { executeAction };
