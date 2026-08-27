"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { attachWebContainerEvents } from "@/lib/webcontainer/events";
import { mountAndIndex } from "@/lib/webcontainer/filesystem";
import { runInstall, runDev, restartDev } from "@/lib/webcontainer/process";
import { mcpUseStarterTree } from "@/lib/templates/mcpuse-starter";
import { useWebContainerStore } from "@/store/useWebContainerStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useLogsStore } from "@/store/useLogsStore";
import { useDockviewStore } from "@/store/useDockviewStore";
import { resetLayout } from "@/components/dockview/panelRegistry";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ActivityBar } from "./ActivityBar";

const DockviewLayout = dynamic(
  () =>
    import("@/components/dockview/DockviewLayout").then(
      (m) => m.DockviewLayout,
    ),
  { ssr: false },
);

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  booting: "Booting",
  installing: "Installing",
  running: "Running",
  error: "Error",
};

export function IdeWorkspace() {
  const status = useWebContainerStore((state) => state.status);
  const error = useWebContainerStore((state) => state.error);
  const mode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const dockviewApi = useDockviewStore((state) => state.api);
  const bootstrapped = useRef(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cleanupEvents: (() => void) | undefined;

    async function bootstrap() {
      const setStatus = useWebContainerStore.getState().setStatus;
      const setError = useWebContainerStore.getState().setError;
      try {
        setStatus("booting");
        useLogsStore.getState().append("lifecycle", "Booting WebContainer…\n");
        const instance = await getWebContainer();
        cleanupEvents = attachWebContainerEvents(instance);

        await mountAndIndex(instance, mcpUseStarterTree);
        await runInstall(instance);
        await runDev(instance);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void bootstrap();

    return () => {
      cleanupEvents?.();
    };
  }, []);

  async function handleRestart() {
    setRestarting(true);
    try {
      const instance = await getWebContainer();
      await restartDev(instance);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        <header className="flex h-9 shrink-0 items-center justify-between bg-[#eaeef2] px-3 dark:bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
              In-Browser IDE
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                status === "error"
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : status === "running"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRestart}
              disabled={restarting}
              className="rounded px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Restart Dev Server
            </button>
            <button
              type="button"
              onClick={() => dockviewApi && resetLayout(dockviewApi)}
              className="rounded px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Reset Layout
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {mode === "light" ? "Dark mode" : "Light mode"}
            </button>
          </div>
        </header>

        {error && (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 bg-[#eaeef2] dark:bg-[#0d1117]">
          <ActivityBar />
          <div className="min-w-0 flex-1">
            <DockviewLayout />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
