"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/server/auth/context";
import {
  createProject,
  softDeleteProject,
} from "@/server/services/projects.service";
import { createProjectSchema } from "@/server/schemas/common";

export async function createProjectAction(formData: FormData) {
  const auth = await getAuthContext();
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
  };

  const parsed = createProjectSchema.parse({
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    description: raw.description == null ? undefined : String(raw.description),
  });

  await createProject({
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description ?? null,
    ownerId: auth.userId,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProjectAction(projectId: string) {
  const auth = await getAuthContext();
  await softDeleteProject(projectId, auth.userId);
  revalidatePath("/projects");
  redirect("/projects");
}
