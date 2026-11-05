import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

const loadUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const id = session?.user?.userId;
  if (typeof id !== "number") return null;
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
});

/** The signed-in user for a page; sends them to sign-in if the session is gone or the account was deleted. */
export async function currentUser(): Promise<User> {
  await connection(); // auth() uses crypto, which can't run during prerendering
  const user = await loadUser();
  if (!user) redirect("/signin");
  return user;
}

/** Server Actions are reachable by POST, so check the session again instead of trusting proxy.ts alone. */
export async function requireUser(): Promise<User> {
  const user = await loadUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
