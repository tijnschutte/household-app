import { z } from "zod";

const schema = z.object({
  username: z.string().min(3).max(20),
  password: z.string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
});

type Schema = z.infer<typeof schema>;

export { schema, type Schema };