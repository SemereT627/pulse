import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Anyone who signs in with GitHub. Tokens are encrypted (lib/crypto.ts); a PAT, when set, is used instead of the sign-in token.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  oauthToken: text("oauth_token"),
  pat: text("pat"),
  // GitHub answered 401 with the token in use; cleared on the next sign-in or PAT change.
  tokenInvalid: boolean("token_invalid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

const userId = () =>
  integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

// One row per user (settings, rate_limit).

export const settings = pgTable("settings", {
  userId: userId().primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  weekStartDay: smallint("week_start_day").notNull().default(1), // 0 = Sun … 6 = Sat
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  cronEnabled: boolean("cron_enabled").notNull().default(true),
  emailTo: text("email_to"),

  // AI summary. Keys live in ai_keys; these only pick and shape the call.
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
  defaultExtraBranches: text("default_extra_branches").array().notNull().default([]),

  // Report and schedule.
  reportAuthor: text("report_author"), // null = GitHub profile name, then login
  mdSections: text("md_sections").array().notNull().default(["summary", "commits", "reviews", "releases"]),
  reportDay: smallint("report_day").notNull().default(1), // 0 = Sun … 6 = Sat, in `timezone`
});

export const aiKeys = pgTable(
  "ai_keys",
  {
    userId: userId(),
    provider: text("provider").notNull(),
    key: text("key").notNull(), // encrypted
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

export type Settings = typeof settings.$inferSelect;

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    githubNodeId: text("github_node_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    isPrivate: boolean("is_private").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    defaultBranch: text("default_branch"),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    included: boolean("included").notNull().default(false),
    // Counted in addition to the default branch; commits are deduped by sha.
    extraBranches: text("extra_branches").array().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_user_repo").on(t.userId, t.githubNodeId)],
);

// Raw GitHub data per week, so viewing a report doesn't re-hit the API.
// key = "repo:<sources.id>" for commits/releases, "user" for PRs/reviews/issues (searched account-wide).
export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    key: text("key").notNull(),
    weekStart: date("week_start").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("snapshots_user_key_week").on(t.userId, t.key, t.weekStart)],
);

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    userId: userId(),
    weekStart: date("week_start").notNull(),
    weekEnd: date("week_end").notNull(),
    stats: jsonb("stats").notNull(),
    narrative: text("narrative"),
    narrativeModel: text("narrative_model"),
    markdown: text("markdown").notNull(),
    trigger: text("trigger", { enum: ["cron", "manual"] }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reports_user_week").on(t.userId, t.weekStart)],
);

export const rateLimit = pgTable("rate_limit", {
  userId: userId().primaryKey(),
  remaining: integer("remaining").notNull(),
  limit: integer("limit").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Source = typeof sources.$inferSelect;
