import { create } from "zustand";

export type LogSource = "install" | "dev" | "lifecycle" | "error";

export interface LogLine {
  id: number;
  source: LogSource;
  text: string;
  timestamp: number;
}

const MAX_LOG_LINES = 2000;

let nextId = 0;

interface LogsState {
  lines: LogLine[];
  /** Uncommitted, spinner-driven text per source — the "live" line before its next `\n`. */
  pending: Partial<Record<LogSource, string>>;
  append: (source: LogSource, text: string) => void;
  setPending: (source: LogSource, text: string) => void;
  clear: () => void;
}

export const useLogsStore = create<LogsState>((set) => ({
  lines: [],
  pending: {},
  append: (source, text) =>
    set((state) => {
      const next = [
        ...state.lines,
        { id: nextId++, source, text, timestamp: Date.now() },
      ];
      return {
        lines: next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next,
      };
    }),
  setPending: (source, text) =>
    set((state) => ({ pending: { ...state.pending, [source]: text } })),
  clear: () => set({ lines: [], pending: {} }),
}));
