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
    
            if (!parsedCredentials.success) return null;
            
            const { name, password } = parsedCredentials.data;
            const user = await getUser(name);
            if (!user) return null;
                
            const passwordsMatch = await bcrypt.compare(password, user.password);
            if (passwordsMatch) {
                return {
                  id: user.id.toString(),
                  name: user.name,
                  householdId: user.householdId
              };
            }
            return null;
          },
        }),
      ],
  });