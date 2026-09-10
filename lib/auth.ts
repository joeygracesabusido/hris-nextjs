/**
 * Authentication Configuration
 * =============================
 * NextAuth.js configuration with credentials and optional Google OAuth
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  // NOTE: No PrismaAdapter here on purpose. This app uses JWT sessions plus
  // its own cookie auth (isLoggedIn/userRole/...). The adapter would require
  // Account/Session/VerificationToken models that don't exist in the schema.
  // Google users are auto-provisioned in the `signIn` callback below and then
  // bridged to the app cookies via POST /api/auth/google-sync.

  providers: [
    // Credentials Provider (Email/Password)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'email@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            employees: {
              select: {
                id: true,
                employeeId: true,
              },
            },
          },
        })

        if (!user || !user.password) {
          throw new Error('Invalid email or password')
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        // Return user object with role and employee info
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          employeeId: user.employees[0]?.employeeId ?? null,
        }
      },
    }),

    // Google OAuth Provider (Optional)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - add user data to token.
      // For Google OAuth, `user` is the Google profile (no role), so look up
      // the provisioned DB user to attach id/role.
      if (user?.email) {
        if ((user as { role?: string }).role) {
          token.id = user.id
          token.role = (user as { role: string }).role
          token.employeeId = (user as { employeeId?: string | null }).employeeId ?? null
        } else {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
            select: { id: true, role: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
          }
        }
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name
        token.role = session.role
      }

      return token
    },

    async session({ session, token }) {
      // Add token data to session
      if (token) {
        session.user.id = (token.id as string) || ''
        session.user.role = (token.role as string) || 'EMPLOYEE'
        session.user.employeeId = (token.employeeId as string | null) ?? null
      }
      return session
    },

    async signIn({ user, account }) {
      // For OAuth providers, auto-provision a user record if needed.
      // Approval (FOR_APPROVAL/REJECTED) is enforced later in
      // POST /api/auth/google-sync so the login page can show a message.
      if (account?.provider && account.provider !== 'credentials') {
        if (!user.email) return false
        const email = user.email.toLowerCase()
        const existingUser = await prisma.user.findUnique({
          where: { email },
        })
        if (!existingUser) {
          // Create new user with default role (status defaults to FOR_APPROVAL)
          await prisma.user.create({
            data: {
              email,
              username: email,
              name: user.name,
              image: user.image,
              role: 'EMPLOYEE',
            },
          })
        }
      }
      return true
    },
  },

  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user.email}`)
    },
    async signOut({ token }) {
      console.log(`User signed out: ${token?.email}`)
    },
  },

  debug: process.env.NODE_ENV === 'development',
}

// Extend NextAuth types for custom session properties
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      role: string
      image?: string | null
      employeeId: string | null
    }
  }

  interface User {
    role: string
    employeeId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    employeeId: string | null
  }
}