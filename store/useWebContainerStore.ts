import { create } from "zustand";
import type { WebContainerProcess } from "@webcontainer/api";

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
  /** Handle to the running dev-server process, kept so it can be killed/respawned. */
  devProcess: WebContainerProcess | null;
  setStatus: (status: WebContainerStatus) => void;
  setError: (error: string | null) => void;
  setPreview: (url: string | null, port: number | null) => void;
  setDevProcess: (process: WebContainerProcess | null) => void;
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
