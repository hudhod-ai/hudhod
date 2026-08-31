"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, type ActionState, validationError } from "@/lib/action-state";
import { getAuthContext } from "@/server/auth/context";
import { createProjectSchema } from "@/server/schemas/common";
import { createProject, softDeleteProject } from "@/server/services/projects.service";

export async function createProjectAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await getAuthContext();
  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
  };

  const parsed = createProjectSchema.safeParse({
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    description: raw.description == null ? undefined : String(raw.description),
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    await createProject({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      ownerId: auth.userId,
    });
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProjectAction(projectId: string) {
  const auth = await getAuthContext();
  await softDeleteProject(projectId, auth.userId);
  revalidatePath("/projects");
  redirect("/projects");
}
