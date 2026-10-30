"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireUser } from "@/lib/session";

const TOGGLES = ["aiEnabled", "cronEnabled"] as const;
export type SettingToggle = (typeof TOGGLES)[number];

export async function setToggleAction(key: SettingToggle, value: boolean) {
  await requireUser();
  if (!TOGGLES.includes(key)) throw new Error("Unknown setting");
  await db.update(settings).set({ [key]: value }).where(eq(settings.id, 1));
  refresh();
}
