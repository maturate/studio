import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db, users, allowedEmails } from "@superos/db";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
    error: "/unauthorized",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      const [allowed] = await db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.email, email))
        .limit(1);
      const isAuthorized = Boolean(allowed?.active);

      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existing) {
        await db
          .update(users)
          .set({
            name: user.name ?? existing.name,
            avatarUrl: user.image ?? existing.avatarUrl,
            googleSubjectId: account?.providerAccountId ?? existing.googleSubjectId,
            isAuthorized,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          email,
          name: user.name,
          avatarUrl: user.image,
          googleSubjectId: account?.providerAccountId,
          isAuthorized,
        });
      }

      // Returning false blocks session creation entirely — an unauthorized
      // Google account never gets a usable app session (AGENTS.md 12.2).
      return isAuthorized;
    },
    async jwt({ token }) {
      if (!token.email) return token;

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, token.email.toLowerCase()))
        .limit(1);

      if (dbUser) {
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.isAuthorized = dbUser.isAuthorized;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as string;
        session.user.isAuthorized = token.isAuthorized as boolean;
      }
      return session;
    },
  },
});
