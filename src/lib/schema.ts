import { z } from "zod";

const schema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(3),
});

type Schema = z.infer<typeof schema>;

export { schema, type Schema };