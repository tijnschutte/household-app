import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials";
import db from "@/src/lib/db/db";
import bcrypt from "bcryptjs";
import { schema } from "@/src/lib/schema";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      async authorize(credentials) {
        const { username, password } = schema.parse(credentials);

        const user = await db.user.findFirst({
          where: { name: username },
        });

        if (!user) throw new Error("Invalid credentials");

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) throw new Error("Invalid credentials");

        return {
          id: String(user.id),
          name: user.name,
          email: null,
          image: null,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string; 
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          name: token.name as string
        };
      }
      return session;
    }
  },
});
