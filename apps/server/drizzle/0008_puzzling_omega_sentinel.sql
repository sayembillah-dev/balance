ALTER TABLE "settings" ADD COLUMN "lazy_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "lazy_mode_account_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_lazy_mode_account_id_accounts_id_fk" FOREIGN KEY ("lazy_mode_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;