"use client";

/** Bridges headless workspace events into the current React state projection. */

import type { WebContainerUiHandlers } from "@/lib/webcontainer/events";
import type { WebContainerTaskHandlers } from "@/lib/webcontainer/process";
import { useLogsStore } from "@/store/useLogsStore";
import { useWebContainerStore } from "@/store/useWebContainerStore";

/**
 * Creates callbacks for the existing Zustand-backed workbench UI.
 *
 * The WebContainer helpers depend only on these callbacks; another frontend can
 * supply a different projection without importing Zustand.
 */
export function createWebContainerUiHandlers(): WebContainerUiHandlers &
  WebContainerTaskHandlers {
  return {
    onError(error) {
      useLogsStore.getState().append("error", `${error.message}\n`);
      useWebContainerStore.getState().setError(error.message);
    },
    onLifecycleLog(message) {
      useLogsStore.getState().append("lifecycle", message);
    },
    onLog(source, message) {
      useLogsStore.getState().append(source, message);
    },
    onLogProgress(source, message) {
      useLogsStore.getState().setPending(source, message);
    },
    onPreview(url, port) {
      useWebContainerStore.getState().setPreview(url, port);
    },
    onStatusChange(status) {
      useWebContainerStore.getState().setStatus(status);
    },
    onDevProcess(process) {
      useWebContainerStore.getState().setDevProcess(process);
    },
  };
}