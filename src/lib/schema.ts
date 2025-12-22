import { z } from "zod";

// Schema for sign-up with strict password requirements
const signUpSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(3),
});

// Schema for sign-in with lenient password validation
const signInSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(1, "Password is required"),
});

// Schema for grocery item names - allow most common characters
const groceryItemSchema = z.object({
  name: z.string()
    .min(1, "Item name is required")
    .max(100, "Item name is too long")
    .refine(
      (val) => val.trim().length > 0,
      "Item name cannot be only whitespace"
    ),
});

type SignUpSchema = z.infer<typeof signUpSchema>;
type SignInSchema = z.infer<typeof signInSchema>;
type GroceryItemSchema = z.infer<typeof groceryItemSchema>;

// Keep the old 'schema' export for backward compatibility with sign-up
const schema = signUpSchema;
type Schema = SignUpSchema;

export {
  schema,
  signUpSchema,
  signInSchema,
  groceryItemSchema,
  type Schema,
  type SignUpSchema,
  type SignInSchema,
  type GroceryItemSchema
};