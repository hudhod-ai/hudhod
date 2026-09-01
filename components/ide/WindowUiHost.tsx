"use client";

/**
 * Renders pending window UI requests as React components.
 *
 * Provides default UIs (InputDialog + sonner toasts) with support for custom
 * component overrides via context or props.
 */

import { useEffect } from "react";
import { toast } from "sonner";
import { InputDialog } from "@/components/ui/InputDialog";
import { useWindowUiStore } from "@/store/useWindowUiStore";

export interface WindowUiHostProps {
  /** Custom message toast behavior */
  messageComponent?: React.ComponentType<{
    message: string;
    severity?: "info" | "warning" | "error";
    onResolve: () => void;
  }>;
}

export function WindowUiHost(_props: WindowUiHostProps = {}) {
  const pending = useWindowUiStore((state) => state.pending);
  const resolvePending = useWindowUiStore((state) => state.resolvePending);
  const dismissPending = useWindowUiStore((state) => state.dismissPending);

  // Default behavior: show messages as toasts immediately
  useEffect(() => {
    if (pending?.type === "message") {
      const { message, severity } = pending;
      if (severity === "error") {
        toast.error(message);
      } else if (severity === "warning") {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      pending.resolve();
      useWindowUiStore.getState().dismissPending();
    }
  }, [pending?.type === "message" ? pending : null]);

  if (pending?.type === "inputBox") {
    const { options } = pending;
    return (
      <InputDialog
        open={true}
        title={options?.title ?? "Input"}
        label={options?.placeholder ?? ""}
        submitLabel={options?.confirmLabel ?? "OK"}
        defaultValue={options?.value ?? ""}
        onOpenChange={(open) => {
          if (!open) dismissPending();
        }}
        onSubmit={(value) => {
          resolvePending(value);
        }}
      />
    );
  }

  return null;
}
