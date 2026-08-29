import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/server/auth/context";
import { getProjectById } from "@/server/services/projects.service";
import { getVersion } from "@/server/services/versions.service";

export default async function ProjectVersionPage({
  params,
}: {
  params: Promise<{ id: string; revision: string }>;
}) {
  const auth = await getAuthContext();
  const { id, revision } = await params;

  const project = await getProjectById(id, auth.userId).catch(() => null);
  if (!project) {
    redirect("/projects");
  }

  const version = await getVersion(id, Number(revision), auth.userId).catch(
    () => null,
  );
  if (!version) {
    redirect(`/projects/${id}`);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Version details
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {version.label ?? `v${version.revision}`}
          </h1>
        </div>
        <Link
          href={`/projects/${id}`}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Back to project
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm text-zinc-500">Revision</p>
          <p className="mt-1 text-lg font-medium">{version.revision}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Checksum</p>
          <p className="mt-1 break-all font-mono text-sm text-zinc-700">
            {version.checksumSha256}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Archive</p>
          <p className="mt-1 text-zinc-700">
            {version.storageBucket}/{version.storageKey}
          </p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Created</p>
          <p className="mt-1 text-zinc-700">
            {new Date(version.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </main>
  );
}
