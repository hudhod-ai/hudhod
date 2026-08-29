import { redirect } from "next/navigation";

import { IdeWorkspace } from "@/components/ide/IdeWorkspace";
import { getAuthContext } from "@/server/auth/context";
import { getProjectById } from "@/server/services/projects.service";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getAuthContext();
  const { id } = await params;

  const project = await getProjectById(id, auth.userId).catch(() => null);
  if (!project) {
    redirect("/projects");
  }

  return <IdeWorkspace projectId={id} projectName={project.name} />;
}
