"use server";

import { eq, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { syncSources } from "@/lib/github/repos";
import { requireUser } from "@/lib/session";

export async function syncReposAction() {
  await requireUser();
  await syncSources();
  refresh();
}

export async function setIncludedAction(ids: number[], included: boolean) {
  await requireUser();
  if (ids.length === 0) return;
  await db.update(sources).set({ included, updatedAt: new Date() }).where(inArray(sources.id, ids));
  refresh();
}

export async function setBranchesAction(id: number, raw: string) {
  await requireUser();
  const branches = [...new Set(raw.split(",").map((b) => b.trim()).filter(Boolean))];
  await db.update(sources).set({ extraBranches: branches, updatedAt: new Date() }).where(eq(sources.id, id));
  refresh();
}
