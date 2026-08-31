import type { ProcessHandle } from "@hudhod/sdk";
import { create } from "zustand";

export type WebContainerStatus =
  | "idle"
  | "booting"
  | "installing"
  | "starting"
  | "running"
  | "error";

interface WebContainerState {
  status: WebContainerStatus;
  error: string | null;
  previewUrl: string | null;
  previewPort: number | null;
  /** Handle to the running dev server, kept so it can be restarted. */
  devProcess: ProcessHandle | null;
  setStatus: (status: WebContainerStatus) => void;
  setError: (error: string | null) => void;
  setPreview: (url: string | null, port: number | null) => void;
  setDevProcess: (process: ProcessHandle | null) => void;
}

export const useWebContainerStore = create<WebContainerState>((set) => ({
  status: "idle",
  error: null,
  previewUrl: null,
  previewPort: null,
  devProcess: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? "error" : "running" }),
  setPreview: (previewUrl, previewPort) => set({ previewUrl, previewPort }),
  setDevProcess: (devProcess) => set({ devProcess }),
}));
