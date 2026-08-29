ALTER TABLE "project_versions" DROP CONSTRAINT "project_versions_restored_from_version_id_project_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "project_versions" ALTER COLUMN "revision" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "project_versions" ALTER COLUMN "size_bytes" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "project_versions" ALTER COLUMN "file_count" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_restored_from_version_id_fk" FOREIGN KEY ("restored_from_version_id") REFERENCES "public"."project_versions"("id") ON DELETE no action ON UPDATE no action;