import { z } from "zod";

/**
 * What a valid credential is, said once. The sign-up action, NextAuth's
 * credentials provider and both forms all parse through these, so neither side
 * of the boundary restates the rules.
 *
 * Sign-up and sign-in differ on purpose: sign-up enforces the password policy,
 * sign-in only checks that something was typed. Tightening the policy must not
 * lock out an account that predates it.
 */

const noSpaces = (val: string) => !val.includes(" ");

const username = z
  .string()
  .min(3, "Gebruikersnaam moet minimaal 3 karakters zijn")
  .max(15, "Gebruikersnaam mag maximaal 15 karakters zijn")
  .refine(noSpaces, "Gebruikersnaam mag geen spaties bevatten");

// bcrypt only hashes the first 72 bytes, so anything longer is silently ignored.
const MAX_PASSWORD_LENGTH = 72;

export const signUpSchema = z.object({
  username,
  password: z
    .string()
    .min(3, "Wachtwoord moet minimaal 3 karakters zijn")
    .max(MAX_PASSWORD_LENGTH, "Wachtwoord mag maximaal 72 karakters zijn")
    .refine(noSpaces, "Wachtwoord mag geen spaties bevatten"),
});

export const signInSchema = z.object({
  username,
  password: z
    .string()
    .min(1, "Wachtwoord is vereist")
    .max(MAX_PASSWORD_LENGTH, "Wachtwoord mag maximaal 72 karakters zijn")
    .refine(noSpaces, "Wachtwoord mag geen spaties bevatten"),
});
