import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

// Add proper typings
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
    }
  }
}

// Add typing for JWT
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    sub?: string;
  }
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    session({ session, token }: { session: any; token: JWT }) {
      // Use the sub field from the token as the user ID
      if (session.user) {
        // Prioritize id if it exists, otherwise use sub
        session.user.id = token.id || token.sub || '';
      }
      return session;
    },
    jwt({ token, user }: { token: JWT; user: any }) {
      // If we have a user (during sign in), add the id
      if (user && user.id) {
        token.id = String(user.id);
      }
      
      // If we don't have an id but we have a sub, use that as the id
      if (!token.id && token.sub) {
        token.id = token.sub;
      }
      
      return token;
    },
  },
  providers: [], // Add authentication providers here
} satisfies NextAuthConfig;