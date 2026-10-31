import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Single-row tables (settings, rate_limit) use id = 1.

export const settings = pgTable("settings", {
  id: smallint("id").primaryKey().default(1),
  timezone: text("timezone").notNull().default("Africa/Addis_Ababa"),
  weekStartDay: smallint("week_start_day").notNull().default(5), // 0 = Sun … 5 = Fri
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  cronEnabled: boolean("cron_enabled").notNull().default(true),
  emailTo: text("email_to"),

  // AI summary. API keys stay in env vars; these only pick and shape the call.
  aiProvider: text("ai_provider", {
    enum: ["anthropic", "openai", "gemini", "github", "groq", "openrouter", "mistral", "cerebras", "deepseek"],
  }).notNull().default("anthropic"),
  aiModel: text("ai_model"), // null = the provider's default
  aiTone: text("ai_tone", { enum: ["professional", "conversational", "concise"] }).notNull().default("professional"),
  aiLength: text("ai_length", { enum: ["short", "medium", "long"] }).notNull().default("medium"),
  aiInstructions: text("ai_instructions"),
  aiUsePrevious: boolean("ai_use_previous").notNull().default(true),

  // What counts.
  excludePromotionPrs: boolean("exclude_promotion_prs").notNull().default(true),
  extraAuthorLogins: text("extra_author_logins").array().notNull().default([]),
  defaultExtraBranches: text("default_extra_branches").array().notNull().default(["dev"]),

  // Report and schedule.
  reportAuthor: text("report_author"), // null = REPORT_NAME env
  mdSections: text("md_sections").array().notNull().default(["summary", "commits", "reviews", "releases"]),
  reportDay: smallint("report_day").notNull().default(5), // 0 = Sun … 6 = Sat, in `timezone`
});

export type Settings = typeof settings.$inferSelect;

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  githubNodeId: text("github_node_id").notNull().unique(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  isPrivate: boolean("is_private").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  defaultBranch: text("default_branch"),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  included: boolean("included").notNull().default(false),
  // Counted in addition to the default branch; commits are deduped by sha.
  extraBranches: text("extra_branches").array().notNull().default(["dev"]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Raw GitHub data per week, so viewing a report doesn't re-hit the API.
// key = "repo:<sources.id>" for commits/releases, "user" for PRs/reviews/issues (searched account-wide).
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    weekStart: date("week_start").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("snapshots_key_week").on(t.key, t.weekStart)],
);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull().unique(),
  weekEnd: date("week_end").notNull(),
  stats: jsonb("stats").notNull(),
  narrative: text("narrative"),
  narrativeModel: text("narrative_model"),
  markdown: text("markdown").notNull(),
  trigger: text("trigger", { enum: ["cron", "manual"] }).notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimit = pgTable("rate_limit", {
  id: smallint("id").primaryKey().default(1),
  remaining: integer("remaining").notNull(),
  limit: integer("limit").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Source = typeof sources.$inferSelect;
