import "server-only";
import { graphql } from "@octokit/graphql";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit, users, type User } from "@/db/schema";
import { decrypt } from "@/lib/crypto";

// Appended to every query so the footer can show remaining quota.
export const RATE_LIMIT_FIELDS = "rateLimit { cost remaining limit resetAt }";

type RateLimitInfo = { cost: number; remaining: number; limit: number; resetAt: string };

/** The token GitHub calls use: the user's PAT if they saved one, else the sign-in token. */
export function githubToken(user: Pick<User, "pat" | "oauthToken">): string | null {
  const stored = user.pat ?? user.oauthToken;
  return stored ? decrypt(stored) : null;
}

export async function gh<T>(user: User, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = githubToken(user);
  if (!token) throw new Error("No GitHub token. Sign out and sign in again.");
  try {
    const data = await graphql<T & { rateLimit?: RateLimitInfo }>(query, {
      ...variables,
      headers: { authorization: `bearer ${token}` },
    });
    if (data.rateLimit) await saveRateLimit(user.id, data.rateLimit);
    return data;
  } catch (e) {
    if ((e as { status?: number }).status === 401) {
      await db.update(users).set({ tokenInvalid: true }).where(eq(users.id, user.id));
      throw new Error(
        user.pat
          ? "GitHub rejected your personal access token. Replace or remove it in Settings."
          : "GitHub rejected your sign-in. Sign out and sign in again.",
      );
    }
    throw e;
  }
}

async function saveRateLimit(userId: number, { remaining, limit, resetAt }: RateLimitInfo) {
  const values = { remaining, limit, resetAt: new Date(resetAt), updatedAt: new Date() };
  await db.insert(rateLimit).values({ userId, ...values }).onConflictDoUpdate({ target: rateLimit.userId, set: values });
}
