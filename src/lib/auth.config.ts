import type { NextAuthConfig } from "next-auth";

// Kept deliberately free of the Credentials provider (and therefore bcrypt +
// Prisma) so middleware - which runs on Vercel's size-constrained Edge
// runtime - only bundles this lightweight config, not the full auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
