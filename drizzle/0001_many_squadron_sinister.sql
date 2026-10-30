ALTER TABLE "settings" ADD COLUMN "ai_provider" text DEFAULT 'anthropic' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_tone" text DEFAULT 'professional' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_length" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_instructions" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_use_previous" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "exclude_promotion_prs" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "extra_author_logins" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_extra_branches" text[] DEFAULT '{"dev"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "report_author" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "md_sections" text[] DEFAULT '{"summary","commits","reviews","releases"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "report_day" smallint DEFAULT 5 NOT NULL;