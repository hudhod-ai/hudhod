import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/server/http/errors";

export type ProjectInsert = {
  name: string;
  slug: string;
  description?: string | null;
  ownerId: string;
};

export async function listProjectsForOwner(ownerId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.updatedAt));
}

export async function getProjectById(projectId: string, ownerId: string) {
  const result = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (!result[0]) {
    throw new NotFoundError("Project not found.");
  }

  return result[0];
}

export async function createProject(input: ProjectInsert) {
  const slug = input.slug.trim();
  if (!slug.length) {
    throw new BadRequestError("Project slug is required.");
  }

  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, input.ownerId),
        eq(projects.slug, slug),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (existing[0]) {
    throw new ConflictError("A project with this slug already exists.");
  }

  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      ownerId: input.ownerId,
      createdBy: input.ownerId,
      updatedBy: input.ownerId,
    })
    .returning();

  return project;
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

  const [updated] = await db
    .update(projects)
    .set({
      name: input.name ?? current.name,
      slug: nextSlug,
      description: input.description ?? current.description,
      updatedAt: new Date(),
      updatedBy: ownerId,
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        isNull(projects.deletedAt),
      ),
    )
    .returning();

  return updated;
}

export async function softDeleteProject(projectId: string, ownerId: string) {
  const current = await getProjectById(projectId, ownerId);

  const [deleted] = await db
    .update(projects)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: ownerId,
    })
    .where(
      and(
        eq(projects.id, current.id),
        eq(projects.ownerId, ownerId),
        isNull(projects.deletedAt),
      ),
    )
    .returning();

  return deleted;
}
