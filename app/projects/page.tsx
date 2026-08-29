import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { deleteProjectAction } from "@/app/projects/actions";
import { getAuthContext } from "@/server/auth/context";
import { listProjectsForOwner } from "@/server/services/projects.service";

export default async function ProjectsPage() {
  const auth = await getAuthContext();
  const projects = await listProjectsForOwner(auth.userId);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">Projects</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Project dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <form action={signOutAction}>
            <button className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100">
              Sign out
            </button>
          </form>
          <Link
            href="/projects/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            New project
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {projects.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">You do not have any projects yet.</p>
            <Link
              href="/projects/new"
              className="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-lg font-semibold text-zinc-900 hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">/{project.slug}</p>
                  {project.description ? (
                    <p className="mt-2 max-w-2xl text-sm text-zinc-600">{project.description}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/projects/${project.id}/workspace`}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    Open workspace
                  </Link>
                  <form action={deleteProjectAction.bind(null, project.id)}>
                    <button
                      type="submit"
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
