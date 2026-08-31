"use client";

import type { ActionState } from "@/lib/action-state";

type ActionMessageProps = {
  state: ActionState;
  field?: string;
};

export function ActionMessage({ state, field }: ActionMessageProps) {
  if (state.status !== "error") return null;

  const message = field ? state.fieldErrors?.[field]?.[0] : state.message;
  if (!message) return null;

  return <p className="text-sm text-destructive">{message}</p>;
}
