import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/server/auth/context";
import { getProjectById } from "@/server/services/projects.service";
import { listVersionsForProject } from "@/server/services/versions.service";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  const { id } = await params;

  const project = await getProjectById(id, auth.userId).catch(() => null);
  if (!project) {
    redirect("/projects");
  }

  const versions = await listVersionsForProject(id, auth.userId);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">Project</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/projects/${id}/workspace`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Open workspace
          </Link>
          <Link
            href="/projects"
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to projects
          </Link>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-500">Slug</p>
        <p className="mt-2 text-lg font-medium">{project.slug}</p>
        {project.description ? (
          <>
            <p className="mt-6 text-sm text-zinc-500">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-zinc-700">{project.description}</p>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Versions</h2>
          <Link
            href={`/projects/${id}/workspace`}
            className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline"
          >
            Save new version
          </Link>
        </div>

        <div className="space-y-3">
          {versions.length === 0 ? (
            <p className="text-sm text-zinc-500">No versions yet.</p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-800">
                    {version.label ?? `v${version.revision}`}
                  </p>
                  <p className="text-sm text-zinc-500">
                    Revision {version.revision} • {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/projects/${id}/versions/${version.revision}`}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    View
                  </Link>
                  <Link
                    href={`/projects/${id}/workspace?restore=${version.revision}`}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    Restore
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
