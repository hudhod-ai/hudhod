"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createProjectAction } from "@/app/projects/actions";
import { ActionMessage } from "@/components/forms/ActionMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { useActionToast } from "@/components/forms/useActionToast";
import { initialActionState } from "@/lib/action-state";

export default function NewProjectPage() {
  const [state, action] = useActionState(createProjectAction, initialActionState);
  useActionToast(state);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">New project</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create a project</h1>
      </div>

      <form
        action={action}
        className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <ActionMessage state={state} />
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
            Project name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 ring-0 transition outline-none focus:border-zinc-400"
          />
          <ActionMessage state={state} field="name" />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium text-zinc-700">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="^[a-z0-9-]+$"
            placeholder="my-cool-project"
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 ring-0 transition outline-none focus:border-zinc-400"
          />
          <ActionMessage state={state} field="slug" />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 transition outline-none focus:border-zinc-400"
          />
          <ActionMessage state={state} field="description" />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/projects"
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Cancel
          </Link>
          <SubmitButton pendingLabel="Creating...">Create project</SubmitButton>
        </div>
      </form>
    </main>
  );
}
