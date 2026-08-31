"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import type { ActionState } from "@/lib/action-state";

export function useActionToast(state: ActionState) {
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    if (state.status === "success") toast.success(state.message);
  }, [state]);
}
