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
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id || ""; 
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: typeof token.id === "string" ? token.id : "",
          name: typeof token.name === "string" ? token.name : ""
        };
      }
      return session;
    }
  },
});
