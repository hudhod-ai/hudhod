import { createClient } from "@/lib/server";
import { createAdminClient } from "@/lib/admin";
import { calculateChecksum } from "@/server/archive";
import { env } from "@/server/env";
import { BadRequestError, NotFoundError } from "@/server/http/errors";
import { getStorageProvider } from "@/server/storage";

export type VersionInput = {
  label?: string;
  description?: string | null;
  archive: Buffer;
  contentType?: string;
  restoreFromVersionId?: string | null;
};

export type ProjectVersion = {
  id: string;
  projectId: string;
  revision: number;
  label: string | null;
  description: string | null;
  storageKey: string;
  storageBucket: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  fileCount: number;
  restoredFromVersionId: string | null;
  downloadToken: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type ProjectVersionRow = {
  id: string;
  project_id: string;
  revision: number;
  label: string | null;
  description: string | null;
  storage_key: string;
  storage_bucket: string;
  content_type: string;
  size_bytes: number;
  checksum_sha256: string;
  file_count: number;
  restored_from_version_id: string | null;
  download_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toProjectVersion(row: ProjectVersionRow): ProjectVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    revision: row.revision,
    label: row.label,
    description: row.description,
    storageKey: row.storage_key,
    storageBucket: row.storage_bucket,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    checksumSha256: row.checksum_sha256,
    fileCount: row.file_count,
    restoredFromVersionId: row.restored_from_version_id,
    downloadToken: row.download_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function requireProject(projectId: string, ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Project not found.");
}

export async function listVersionsForProject(
  projectId: string,
  ownerId: string,
) {
  await requireProject(projectId, ownerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_versions")
    .select()
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("revision", { ascending: false });
  if (error) throw error;
  return (data as ProjectVersionRow[]).map(toProjectVersion);
}

export async function createVersionForProject(
  projectId: string,
  ownerId: string,
  input: VersionInput,
) {
  await requireProject(projectId, ownerId);
  if (!input.archive.length)
    throw new BadRequestError("Version archive is empty.");

  const supabase = await createClient();
  const { data: latest, error: latestError } = await supabase
    .from("project_versions")
    .select("revision")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  const nextRevision = (latest?.revision ?? 0) + 1;
  const storageKey = `projects/${projectId}/versions/${nextRevision}.json`;
  const storage = await getStorageProvider();
  const storedArchive = await storage.putObject({
    bucket: env.STORAGE_BUCKET,
    key: storageKey,
    body: input.archive,
    contentType: input.contentType ?? "application/json",
  });

  const { data, error } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      revision: nextRevision,
      label: input.label ?? `v${nextRevision}`,
      description: input.description ?? null,
      storage_key: storedArchive.key,
      storage_bucket: storedArchive.bucket,
      content_type: storedArchive.contentType,
      size_bytes: storedArchive.sizeBytes,
      checksum_sha256:
        storedArchive.checksumSha256 ||
        (await calculateChecksum(input.archive)),
      file_count: 1,
      restored_from_version_id: input.restoreFromVersionId ?? null,
      created_by: ownerId,
      updated_by: ownerId,
    })
    .select()
    .single();
  if (error) throw error;

  const version = toProjectVersion(data as ProjectVersionRow);
  const { error: projectError } = await supabase
    .from("projects")
    .update({
      current_version_id: version.id,
      updated_at: new Date().toISOString(),
      updated_by: ownerId,
    })
    .eq("id", projectId)
    .eq("owner_id", ownerId);
  if (projectError) throw projectError;
  return version;
}

export async function getVersion(
  projectId: string,
  revision: number,
  ownerId: string,
) {
  await requireProject(projectId, ownerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_versions")
    .select()
    .eq("project_id", projectId)
    .eq("revision", revision)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Version not found.");
  return toProjectVersion(data as ProjectVersionRow);
}

export async function getVersionForDownloadToken(
  projectId: string,
  revision: number,
  downloadToken: string,
) {
  const { data, error } = await createAdminClient()
    .from("project_versions")
    .select()
    .eq("project_id", projectId)
    .eq("revision", revision)
    .eq("download_token", downloadToken)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) throw new NotFoundError("Version not found.");
  return toProjectVersion(data as ProjectVersionRow);
}

export async function softDeleteVersion(
  projectId: string,
  revision: number,
  ownerId: string,
) {
  const current = await getVersion(projectId, revision, ownerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_versions")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: ownerId,
    })
    .eq("id", current.id)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) throw error;
  return toProjectVersion(data as ProjectVersionRow);
}
