CREATE TABLE "rate_limit" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"remaining" integer NOT NULL,
	"limit" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"stats" jsonb NOT NULL,
	"narrative" text,
	"narrative_model" text,
	"markdown" text NOT NULL,
	"trigger" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_week_start_unique" UNIQUE("week_start")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Africa/Addis_Ababa' NOT NULL,
	"week_start_day" smallint DEFAULT 5 NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"cron_enabled" boolean DEFAULT true NOT NULL,
	"email_to" text
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"week_start" date NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_node_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"is_private" boolean NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"default_branch" text,
	"pushed_at" timestamp with time zone,
	"included" boolean DEFAULT false NOT NULL,
	"extra_branches" text[] DEFAULT '{"dev"}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_github_node_id_unique" UNIQUE("github_node_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_key_week" ON "snapshots" USING btree ("key","week_start");