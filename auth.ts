import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: { userId: number; login: string; name?: string | null; image?: string | null };
  }
}

type GitHubProfile = { id: number; login: string; name?: string | null; avatar_url?: string | null };

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Anyone can sign in; their own token reads their own GitHub activity.
  // AUTH_GITHUB_ID is the "Pulse Weekly" GitHub App: access comes from its read-only permissions and installs, not scopes.
  providers: [GitHub],
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    // `account` and `profile` are only present on sign-in: store the user and their token, keep only our id in the JWT.
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Imported here so proxy.ts (which only checks the JWT) and build-time route analysis don't load the DB.
        const [{ sql }, { db }, { users }, { encrypt }] = await Promise.all([
          import("drizzle-orm"),
          import("@/db"),
          import("@/db/schema"),
          import("@/lib/crypto"),
        ]);
        const p = profile as unknown as GitHubProfile;
        const values = {
          login: p.login,
          name: p.name ?? null,
          avatarUrl: p.avatar_url ?? null,
          ...(account.access_token && { oauthToken: encrypt(account.access_token) }),
          lastSeenAt: new Date(),
        };
        const [row] = await db
          .insert(users)
          .values({ githubId: p.id, ...values })
          // A fresh sign-in fixes a rejected sign-in token, not a rejected PAT (which is used first).
          .onConflictDoUpdate({
            target: users.githubId,
            set: { ...values, tokenInvalid: sql`${users.pat} is not null and ${users.tokenInvalid}` },
          })
          .returning({ id: users.id });
        token.uid = row.id;
        token.login = p.login;
      }
      return token;
    },
    session({ session, token }) {
      session.user.userId = token.uid as number;
      session.user.login = token.login as string;
      return session;
    },
    // Sessions from before multi-user carry no uid: treat them as signed out.
    authorized({ auth }) {
      return typeof auth?.user?.userId === "number";
    },
  },
});
