import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// Comma-separated GitHub logins allowed to sign in, e.g. "semere-wazza,SemereT627".
const allowedUsers = new Set(
  (process.env.ALLOWED_USERS ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean),
);

declare module "next-auth" {
  interface Session {
    user: { login: string; name?: string | null; image?: string | null };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Sign-in gate only: GitHub data is fetched with GITHUB_PAT, so request no extra scopes.
  providers: [GitHub({ authorization: { params: { scope: "read:user" } } })],
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      const login = typeof profile?.login === "string" ? profile.login.toLowerCase() : "";
      return allowedUsers.has(login);
    },
    jwt({ token, profile }) {
      if (typeof profile?.login === "string") token.login = profile.login;
      return token;
    },
    session({ session, token }) {
      session.user.login = token.login as string;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
