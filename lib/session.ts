import "server-only";
import { auth } from "@/auth";

/** Server Actions are reachable by POST, so check the session again instead of trusting proxy.ts alone. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}
