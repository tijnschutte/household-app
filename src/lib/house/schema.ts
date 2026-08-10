import { z } from "zod";

/** What the server accepts onto a list. The add bar's own limit is stricter — see `parseItemName`. */
export const groceryItemSchema = z.object({
  name: z
    .string()
    .min(1, "Item name is required")
    .max(100, "Item name is too long")
    .refine((val) => val.trim().length > 0, "Item name cannot be only whitespace"),
});

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Categorienaam is vereist")
    .max(30, "Categorienaam mag maximaal 30 karakters zijn"),
});
