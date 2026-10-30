import "server-only";
import { graphql } from "@octokit/graphql";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

const client = graphql.defaults({
  headers: { authorization: `bearer ${process.env.GITHUB_PAT}` },
});

// Appended to every query so the footer can show remaining quota.
export const RATE_LIMIT_FIELDS = "rateLimit { cost remaining limit resetAt }";

type RateLimitInfo = { cost: number; remaining: number; limit: number; resetAt: string };

export async function gh<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const data = await client<T & { rateLimit?: RateLimitInfo }>(query, variables);
  if (data.rateLimit) await saveRateLimit(data.rateLimit);
  return data;
}

async function saveRateLimit({ remaining, limit, resetAt }: RateLimitInfo) {
  const values = { remaining, limit, resetAt: new Date(resetAt), updatedAt: new Date() };
  await db.insert(rateLimit).values({ id: 1, ...values }).onConflictDoUpdate({ target: rateLimit.id, set: values });
}
