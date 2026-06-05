DROP INDEX "invite_token_hash_uq";--> statement-breakpoint
DROP INDEX "pwreset_token_hash_uq";--> statement-breakpoint
DROP INDEX "refresh_token_hash_uq";--> statement-breakpoint
DROP INDEX "users_email_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "invite_token_hash_uq" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pwreset_token_hash_uq" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_token_hash_uq" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");