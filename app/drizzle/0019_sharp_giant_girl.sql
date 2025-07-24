ALTER TABLE "mcp_tools" RENAME COLUMN "payment" TO "pricing";--> statement-breakpoint
DROP INDEX "tool_usage_pricing_id_idx";--> statement-breakpoint
DROP INDEX "tool_usage_tool_pricing_idx";--> statement-breakpoint
ALTER TABLE "mcp_tools" ADD COLUMN "output_schema" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "tool_usage" DROP COLUMN "pricing_id";