ALTER TABLE "tool_pricing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tool_pricing" CASCADE;--> statement-breakpoint
ALTER TABLE "tool_usage" DROP CONSTRAINT "tool_usage_pricing_id_tool_pricing_id_fk";
--> statement-breakpoint
ALTER TABLE "tool_usage" ALTER COLUMN "pricing_id" SET DATA TYPE text;