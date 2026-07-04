CREATE TYPE "public"."recurrence_freq" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"cap_minor" bigint NOT NULL,
	"spent_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "period_start" date;--> statement-breakpoint
ALTER TABLE "pay_receive" ADD COLUMN "recurrence" "recurrence_freq";--> statement-breakpoint
ALTER TABLE "pay_receive" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_periods_budget_idx" ON "budget_periods" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_periods_user_idx" ON "budget_periods" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_periods_budget_start_uq" ON "budget_periods" USING btree ("budget_id","period_start");--> statement-breakpoint
CREATE INDEX "payrecv_series_idx" ON "pay_receive" USING btree ("series_id");