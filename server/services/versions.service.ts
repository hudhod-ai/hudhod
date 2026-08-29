import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db/client";
import { projectVersions, projects } from "@/server/db/schema";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import { calculateChecksum } from "@/server/archive";
import { env } from "@/server/env";
import { getStorageProvider } from "@/server/storage";

export type VersionInput = {
  label?: string;
  description?: string | null;
  archive: Buffer;
  contentType?: string;
  restoreFromVersionId?: string | null;
};

export async function listVersionsForProject(
  projectId: string,
  ownerId: string,
) {
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (!project[0]) {
    throw new NotFoundError("Project not found.");
  }

  return db
    .select()
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.projectId, projectId),
        isNull(projectVersions.deletedAt),
      ),
    )
    .orderBy(desc(projectVersions.revision));
}

export async function createVersionForProject(
  projectId: string,
  ownerId: string,
  input: VersionInput,
) {
  const projectRow = await db
    .select({ id: projects.id, currentVersionId: projects.currentVersionId })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (!projectRow[0]) {
    throw new NotFoundError("Project not found.");
  }

  if (!input.archive.length) {
    throw new BadRequestError("Version archive is empty.");
  }

  const revisionRow = await db
    .select({ maxRevision: projectVersions.revision })
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.projectId, projectId),
        isNull(projectVersions.deletedAt),
      ),
    )
    .orderBy(desc(projectVersions.revision))
    .limit(1);

  const nextRevision = (revisionRow[0]?.maxRevision ?? 0) + 1;
  const checksum = await calculateChecksum(input.archive);
  const storageKey = `projects/${projectId}/versions/${nextRevision}.json`;
  const storage = getStorageProvider();

  const storedArchive = await storage.putObject({
    bucket: env.STORAGE_BUCKET,
    key: storageKey,
    body: input.archive,
    contentType: input.contentType ?? "application/json",
  });

  const [version] = await db
    .insert(projectVersions)
    .values({
      projectId,
      revision: nextRevision,
      label: input.label ?? `v${nextRevision}`,
      description: input.description ?? null,
      storageKey: storedArchive.key,
      storageBucket: storedArchive.bucket,
      contentType: storedArchive.contentType,
      sizeBytes: storedArchive.sizeBytes,
      checksumSha256: storedArchive.checksumSha256 || checksum,
      fileCount: 1,
      restoredFromVersionId: input.restoreFromVersionId ?? null,
      createdBy: ownerId,
      updatedBy: ownerId,
    })
    .returning();

  await db
    .update(projects)
    .set({
      currentVersionId: version.id,
      updatedAt: new Date(),
      updatedBy: ownerId,
    })
    .where(eq(projects.id, projectId));

  return version;
}

export async function getVersion(
  projectId: string,
  revision: number,
  ownerId: string,
) {
  const version = await db
    .select()
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.projectId, projectId),
        eq(projectVersions.revision, revision),
        eq(projects.ownerId, ownerId),
        isNull(projectVersions.deletedAt),
      ),
    )
    .leftJoin(projects, eq(projects.id, projectVersions.projectId))
    .limit(1);

  if (!version[0]) {
    throw new NotFoundError("Version not found.");
  }

  return version[0].project_versions;
}

export async function softDeleteVersion(
  projectId: string,
  revision: number,
  ownerId: string,
) {
  const current = await getVersion(projectId, revision, ownerId);

  const [deleted] = await db
    .update(projectVersions)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: ownerId,
    })
    .where(
      and(
        eq(projectVersions.id, current.id),
        eq(projectVersions.projectId, projectId),
        isNull(projectVersions.deletedAt),
      ),
    )
    .returning();

  return deleted;
}
