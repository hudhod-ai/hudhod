/**
 * Zustand store for imperative window UI requests and responses.
 *
 * This enables React components (like InputDialog) to communicate with
 * extension code running outside the React render cycle.
 */

import type {
  InputBoxOptions,
  QuickPickItem,
  QuickPickOptions,
} from "@hudhod/sdk";
import { create } from "zustand";

export type PendingRequest =
  | {
      type: "inputBox";
      options?: InputBoxOptions;
      resolve: (value: string | undefined) => void;
    }
  | {
      type: "quickPick";
      items: readonly QuickPickItem[];
      options?: QuickPickOptions;
      resolve: (value: string | undefined) => void;
    }
  | {
      type: "message";
      message: string;
      severity?: "info" | "warning" | "error";
      resolve: () => void;
    }
  | null;

interface WindowUiState {
  pending: PendingRequest;
  requestInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  requestQuickPick(
    items: readonly QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | undefined>;
  requestMessage(
    message: string,
    severity?: "info" | "warning" | "error",
  ): Promise<void>;
  resolvePending(value?: string): void;
  dismissPending(): void;
}

export const useWindowUiStore = create<WindowUiState>((set, get) => ({
  pending: null,

  requestInputBox: (options) =>
    new Promise((resolve) => {
      set({ pending: { type: "inputBox", options, resolve } });
    }),

  requestQuickPick: (items, options) =>
    new Promise((resolve) => {
      set({ pending: { type: "quickPick", items, options, resolve } });
    }),

  requestMessage: (message, severity) =>
    new Promise((resolve) => {
      set({ pending: { type: "message", message, severity, resolve } });
    }),

  resolvePending: (value) => {
    const { pending } = get();
    if (!pending) return;
    pending.resolve(value as any);
    set({ pending: null });
  },

  dismissPending: () => {
    const { pending } = get();
    if (!pending) return;
    pending.resolve(undefined as any);
    set({ pending: null });
  },
}));
