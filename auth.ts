import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from "bcryptjs";
import { User } from '@prisma/client';
import prisma from 'lib/prisma';


async function getUser(name: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
        where: {
          name: name,
        },
      });
      if (!user) return null;
      return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}


export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
          async authorize(credentials) {
            const parsedCredentials = z
              .object({ 
                name: z.string().min(3), 
                password: z.string().min(6) 
              })
              .safeParse(credentials);
          
            if (!parsedCredentials.success) {
              throw new Error("Invalid input: Name must be at least 3 characters and password at least 6 characters.");
            }
          
            const { name, password } = parsedCredentials.data;
            const user = await getUser(name);
            
            if (!user) {
              throw new Error("No user found with this name.");
            }
          
            const passwordsMatch = await bcrypt.compare(password, user.password);
            if (!passwordsMatch) {
              throw new Error("Incorrect password.");
            }
          
            return {
              id: user.id.toString(),
              name: user.name,
              householdId: user.householdId
            };
          }
        }),
      ],
  });