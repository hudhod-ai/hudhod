"use client";

import { useActionState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { initialActionState } from "@/lib/action-state";

import { ActionMessage } from "./ActionMessage";
import { SubmitButton } from "./SubmitButton";
import { useActionToast } from "./useActionToast";

export function SignOutButton() {
  const [state, action] = useActionState(signOutAction, initialActionState);
  useActionToast(state);

  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton variant="outline" pendingLabel="Signing out...">
        Sign out
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}
