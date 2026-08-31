"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signUpAction } from "@/app/auth/actions";
import { ActionMessage } from "@/components/forms/ActionMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { useActionToast } from "@/components/forms/useActionToast";
import { initialActionState } from "@/lib/action-state";

export default function SignupPage() {
  const [state, action] = useActionState(signUpAction, initialActionState);
  useActionToast(state);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <form
        action={action}
        className="w-full space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">mcpup</p>
          <h1 className="mt-2 text-3xl font-semibold">Create account</h1>
        </div>
        <ActionMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            First name
            <input
              required
              name="firstName"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Last name
            <input
              required
              name="lastName"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          Email
          <input
            required
            name="email"
            type="email"
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Password
          <input
            required
            name="password"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Phone
            <input
              name="phone"
              type="tel"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Company
            <input
              name="company"
              className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          Country
          <input
            name="country"
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <div className="flex items-center justify-between">
          <Link className="text-sm text-zinc-600 underline" href="/auth/login">
            Already have an account?
          </Link>
          <SubmitButton pendingLabel="Creating account...">Create account</SubmitButton>
        </div>
      </form>
    </main>
  );
}
