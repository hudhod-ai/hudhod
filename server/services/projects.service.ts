import { createClient } from "@/lib/server";
import { mcpUseStarterTree } from "@/lib/templates/mcpuse-starter";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/server/http/errors";
import { createVersionForProject } from "@/server/services/versions.service";

export type ProjectInsert = {
  name: string;
  slug: string;
  description?: string | null;
  ownerId: string;
};

export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  ownerId: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_id: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    ownerId: row.owner_id,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function listProjectsForOwner(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(toProject);
}

export async function getProjectById(projectId: string, ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) {
    throw new NotFoundError("Project not found.");
  }
  return toProject(data as ProjectRow);
}

export async function createProject(input: ProjectInsert) {
  const slug = input.slug.trim();
  if (!slug.length) {
    throw new BadRequestError("Project slug is required.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name,
      slug,
      description: input.description ?? null,
      owner_id: input.ownerId,
      created_by: input.ownerId,
      updated_by: input.ownerId,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505")
      throw new ConflictError("A project with this slug already exists.");
    throw error;
  }
  const project = toProject(data as ProjectRow);
  const starterVersion = await createVersionForProject(
    project.id,
    input.ownerId,
    {
      label: "Initial starter",
      archive: Buffer.from(JSON.stringify(mcpUseStarterTree)),
      contentType: "application/json",
    },
  );

  return { ...project, currentVersionId: starterVersion.id };
}

export async function updateProject(
  projectId: string,
  ownerId: string,
  input: Partial<ProjectInsert>,
) {
  const current = await getProjectById(projectId, ownerId);

  const nextSlug = input.slug?.trim() ?? current.slug;
  if (nextSlug.length === 0) {
    throw new BadRequestError("Project slug cannot be empty.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name ?? current.name,
      slug: nextSlug,
      description: input.description ?? current.description,
      updated_at: new Date().toISOString(),
      updated_by: ownerId,
    })
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .select()
    .single();
  if (error) throw error;
  return toProject(data as ProjectRow);
}

export async function softDeleteProject(projectId: string, ownerId: string) {
  const current = await getProjectById(projectId, ownerId);
  const deletedAt = new Date().toISOString();

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      deleted_at: deletedAt,
      updated_at: deletedAt,
      updated_by: ownerId,
    })
    .eq("id", current.id)
    .eq("owner_id", ownerId)
    .is("deleted_at", null);
  if (error) throw error;
  return { ...current, deletedAt, updatedAt: deletedAt };
}
