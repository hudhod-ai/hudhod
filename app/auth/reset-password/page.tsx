"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/app/auth/actions";
import { ActionMessage } from "@/components/forms/ActionMessage";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { useActionToast } from "@/components/forms/useActionToast";
import { initialActionState } from "@/lib/action-state";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  useActionToast(state);

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <form
        action={action}
        className="w-full space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">mcpup</p>
          <h1 className="mt-2 text-3xl font-semibold">Choose a new password</h1>
        </div>
        <ActionMessage state={state} />
        <label className="block space-y-2 text-sm font-medium">
          New password
          <input
            required
            name="password"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Confirm password
          <input
            required
            name="confirmPassword"
            type="password"
            minLength={8}
            className="block w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-normal"
          />
        </label>
        <SubmitButton className="w-full" pendingLabel="Updating...">
          Update password
        </SubmitButton>
      </form>
    </main>
  );
}
