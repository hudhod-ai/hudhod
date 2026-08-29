import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id").notNull(),
    currentVersionId: uuid("current_version_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("projects_owner_slug_unique")
      .on(table.ownerId, table.slug)
      .where(sql`deleted_at IS NULL`),
    index("projects_owner_id_idx").on(table.ownerId),
    index("projects_deleted_at_idx").on(table.deletedAt),
  ],
);

export const projectVersions = pgTable(
  "project_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    label: text("label"),
    description: text("description"),
    storageKey: text("storage_key").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    contentType: text("content_type").notNull().default("application/gzip"),
    sizeBytes: integer("size_bytes").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    fileCount: integer("file_count").notNull(),
    restoredFromVersionId: uuid("restored_from_version_id"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.restoredFromVersionId],
      foreignColumns: [table.id],
      name: "project_versions_restored_from_version_id_fk",
    }),
    uniqueIndex("project_versions_project_revision_unique").on(
      table.projectId,
      table.revision,
    ),
    index("project_versions_project_id_idx").on(table.projectId),
    index("project_versions_deleted_at_idx").on(table.deletedAt),
  ],
);
