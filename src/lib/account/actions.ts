"use server";

import bcrypt from "bcryptjs";
import db from "@/src/lib/db/db";
import { signUpSchema } from "@/src/lib/account/schema";
import { executeAction } from "@/src/lib/executeAction";
import { rejectingDuplicates } from "@/src/lib/db/duplicates";

/** How many rounds bcrypt costs a sign-up. */
const HASH_ROUNDS = 10;

export const signUp = async (formData: FormData) => {
  return executeAction({
    actionFn: async () => {
      const { username, password } = signUpSchema.parse({
        username: formData.get("username"),
        password: formData.get("password"),
      });

      const hashed = await bcrypt.hash(password, HASH_ROUNDS);

      await rejectingDuplicates(
        () => db.user.create({ data: { name: username, password: hashed } }),
        "Gebruikersnaam bestaat al"
      );
    },
    successMessage: "Account succesvol aangemaakt",
  });
};
