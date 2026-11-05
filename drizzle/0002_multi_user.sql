CREATE TABLE "ai_keys" (
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_keys_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"oauth_token" text,
	"pat" text,
	"token_invalid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_week_start_unique";--> statement-breakpoint
ALTER TABLE "sources" DROP CONSTRAINT "sources_github_node_id_unique";--> statement-breakpoint
DROP INDEX "snapshots_key_week";--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "timezone" SET DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "week_start_day" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "default_extra_branches" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "report_day" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "extra_branches" SET DEFAULT '{}';--> statement-breakpoint
-- Existing single-user data belongs to semere-wazza (GitHub id 265750035); their token is filled in at next sign-in.
INSERT INTO "users" ("github_id", "login") VALUES (265750035, 'semere-wazza');--> statement-breakpoint
ALTER TABLE "rate_limit" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "snapshots" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "rate_limit" SET "user_id" = (SELECT "id" FROM "users" WHERE "github_id" = 265750035);--> statement-breakpoint
UPDATE "reports" SET "user_id" = (SELECT "id" FROM "users" WHERE "github_id" = 265750035);--> statement-breakpoint
UPDATE "settings" SET "user_id" = (SELECT "id" FROM "users" WHERE "github_id" = 265750035);--> statement-breakpoint
UPDATE "snapshots" SET "user_id" = (SELECT "id" FROM "users" WHERE "github_id" = 265750035);--> statement-breakpoint
UPDATE "sources" SET "user_id" = (SELECT "id" FROM "users" WHERE "github_id" = 265750035);--> statement-breakpoint
ALTER TABLE "rate_limit" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "snapshots" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_limit" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "rate_limit" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "settings" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "ai_keys" ADD CONSTRAINT "ai_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit" ADD CONSTRAINT "rate_limit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_user_week" ON "reports" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_user_key_week" ON "snapshots" USING btree ("user_id","key","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_user_repo" ON "sources" USING btree ("user_id","github_node_id");