"use client";

import type { FileSystemTree } from "@webcontainer/api";
import type { CommandRegistry } from "@hudhod/core";
import newFileExtension from "@hudhod/extension-new-file";
import dynamic from "next/dynamic";
import { CommandIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { resetLayout } from "@/components/dockview/panelRegistry";
import { TooltipProvider } from "@/components/ui/SimpleTooltip";
import { WindowUiHost } from "@/components/ide/WindowUiHost";
import { useColorMode } from "@/hooks/useColorMode";
import { createClient } from "@/lib/client";
import { registerBuiltinCommands } from "@/lib/hudhod/builtin-commands";
import { readExplorerTree } from "@/lib/hudhod/file-tree";
import { createWebContainerUiHandlers } from "@/lib/hudhod/ui-bridge";
import {
  getHudhodWorkspace,
  type HudhodWorkspaceRuntime,
} from "@/lib/hudhod/workspace";
import { mcpUseStarterTree } from "@/lib/templates/mcpuse-starter";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { attachWebContainerEvents } from "@/lib/webcontainer/events";
import { mountAndIndex, exportFileSystem } from "@/lib/webcontainer/filesystem";
import { runInstall, runDev, restartDev } from "@/lib/webcontainer/process";
import { useDockviewStore } from "@/store/useDockviewStore";
import { useFileSystemStore } from "@/store/useFileSystemStore";
import { useHudhodWorkspaceStore } from "@/store/useHudhodWorkspaceStore";
import { useLogsStore } from "@/store/useLogsStore";
import { useWebContainerStore } from "@/store/useWebContainerStore";

import { ActivityBar } from "./ActivityBar";
import { CommandPalette } from "./CommandPalette";

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

type IdeWorkspaceProps = {
  projectId?: string;
  projectName?: string;
};

type StoredVersion = {
  id: string;
  revision: number;
  storage_bucket: string;
  storage_key: string;
};

async function downloadVersion(
  version: StoredVersion,
): Promise<FileSystemTree> {
  const { data, error } = await createClient()
    .storage.from(version.storage_bucket)
    .download(version.storage_key);
  if (error) throw error;
  return JSON.parse(await data.text()) as FileSystemTree;
}

export function IdeWorkspace({
  projectId,
  projectName,
}: IdeWorkspaceProps = {}) {
  const status = useWebContainerStore((state) => state.status);
  const error = useWebContainerStore((state) => state.error);
  const { mode, toggle: toggleTheme } = useColorMode();
  const dockviewApi = useDockviewStore((state) => state.api);
  const bootstrapped = useRef(false);
  const [restarting, setRestarting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [commands, setCommands] = useState<CommandRegistry | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const workspaceRef = useRef<HudhodWorkspaceRuntime | null>(null);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cleanupContainerEvents: (() => void) | undefined;
    let cleanupFileWatch: (() => void) | undefined;
    let cleanupCommands: (() => void) | undefined;
    let cleanupPanelWatch: (() => void) | undefined;

    async function bootstrap() {
      const setStatus = useWebContainerStore.getState().setStatus;
      const setError = useWebContainerStore.getState().setError;
      try {
        setStatus("booting");
        useLogsStore.getState().append("lifecycle", "Booting WebContainer…\n");
        const instance = await getWebContainer();
        const uiHandlers = createWebContainerUiHandlers();
        cleanupContainerEvents = attachWebContainerEvents(instance, uiHandlers);

        let initialTree = mcpUseStarterTree;
        if (projectId) {
          const { data: latestVersion, error: versionError } =
            await createClient()
              .from("project_versions")
              .select("id, revision, storage_bucket, storage_key")
              .eq("project_id", projectId)
              .is("deleted_at", null)
              .order("revision", { ascending: false })
              .limit(1)
              .maybeSingle();
          if (versionError) throw versionError;

          if (latestVersion) {
            initialTree = await downloadVersion(latestVersion as StoredVersion);
            useLogsStore
              .getState()
              .append(
                "lifecycle",
                `Loaded project version ${latestVersion.revision}.\n`,
              );
          } else {
            useLogsStore
              .getState()
              .append("lifecycle", "Loaded starter project.\n");
          }
        }

        await mountAndIndex(instance, initialTree);
        const ws = getHudhodWorkspace(instance);
        workspaceRef.current = ws;
        useHudhodWorkspaceStore.getState().setWorkspace(ws);

        (window as any).__hudhod = useHudhodWorkspaceStore;
        // Register the sample extension
        ws.extensions.register(newFileExtension);
        await ws.extensions.activateByEvent("onStartup");

        useHudhodWorkspaceStore.getState().setPanels(ws.panels.getPanels());
        const panelWatch = ws.panels.onDidChangePanels((panels) =>
          useHudhodWorkspaceStore.getState().setPanels(panels),
        );
        cleanupPanelWatch = () => panelWatch.dispose();

        const refreshExplorer = async () => {
          useFileSystemStore.getState().setTree(await readExplorerTree(ws.fs));
        };

        const builtinCommands = registerBuiltinCommands(
          ws.commands,
          ws.keybindings,
          () => setCommandPaletteOpen(true),
          refreshExplorer,
        );
        cleanupCommands = () => builtinCommands.dispose();
        setCommands(ws.commands);

        const fileWatch = ws.fs.onDidChangeFile(() => {
          void refreshExplorer();
        });
        cleanupFileWatch = () => fileWatch.dispose();
        await runInstall(instance, uiHandlers);
        await runDev(instance, uiHandlers);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    void bootstrap();

    return () => {
      cleanupContainerEvents?.();
      cleanupFileWatch?.();
      cleanupCommands?.();
      cleanupPanelWatch?.();
      useHudhodWorkspaceStore.getState().setWorkspace(null);
      useHudhodWorkspaceStore.getState().setPanels([]);
      workspaceRef.current?.dispose();
    };
  }, []);

  async function handleRestart() {
    setRestarting(true);
    try {
      const instance = await getWebContainer();
      await restartDev(instance, createWebContainerUiHandlers());
    } finally {
      setRestarting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const instance = await getWebContainer();
      const tree = await exportFileSystem(instance);
      const blob = new Blob([JSON.stringify(tree, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectName ?? "project"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveVersion() {
    if (!projectId) return;
    setSaving(true);
    try {
      const instance = await getWebContainer();
      const tree = await exportFileSystem(instance);
      const supabase = createClient();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user)
        throw new Error("You must be signed in to save a version.");
      const { data: latest, error: latestError } = await supabase
        .from("project_versions")
        .select("revision")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;
      const revision = (latest?.revision ?? 0) + 1;
      const contents = JSON.stringify(tree);
      const storageKey = `projects/${projectId}/versions/${revision}.json`;
      const archive = new Blob([contents], { type: "application/json" });
      const { error: uploadError } = await supabase.storage
        .from("project-archives")
        .upload(storageKey, archive, { contentType: "application/json" });
      if (uploadError) throw uploadError;
      const checksum = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(contents),
          ),
        ),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      const { data: version, error: insertError } = await supabase
        .from("project_versions")
        .insert({
          project_id: projectId,
          revision,
          label: `Saved ${new Date().toLocaleString()}`,
          storage_key: storageKey,
          storage_bucket: "project-archives",
          content_type: "application/json",
          size_bytes: archive.size,
          checksum_sha256: checksum,
          file_count: 1,
          created_by: userData.user.id,
          updated_by: userData.user.id,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      const { error: projectError } = await supabase
        .from("projects")
        .update({
          current_version_id: version.id,
          updated_by: userData.user.id,
        })
        .eq("id", projectId);
      if (projectError) throw projectError;
      useLogsStore.getState().append("lifecycle", "Project version saved.\n");
    } catch (err) {
      useWebContainerStore
        .getState()
        .setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const handleRestoreVersion = useCallback(async () => {
    if (!projectId) return;
    const revision = new URLSearchParams(window.location.search).get("restore");
    if (!revision) return;
    setRestoring(true);
    try {
      const { data: version, error } = await createClient()
        .from("project_versions")
        .select("id, revision, storage_bucket, storage_key")
        .eq("project_id", projectId)
        .eq("revision", Number(revision))
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !version) throw new Error("Could not load project version.");
      const tree = await downloadVersion(version as StoredVersion);
      const instance = await getWebContainer();
      await instance.mount(tree);
      await restartDev(instance, createWebContainerUiHandlers());
      window.history.replaceState({}, "", `/projects/${projectId}/workspace`);
      useLogsStore
        .getState()
        .append("lifecycle", `Project version ${revision} restored.\n`);
    } catch (err) {
      useWebContainerStore
        .getState()
        .setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const restore = window.setTimeout(() => void handleRestoreVersion(), 0);
    return () => window.clearTimeout(restore);
  }, [handleRestoreVersion, projectId]);

  // Keybinding dispatcher: resolves keyboard events to registered commands
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const ws = workspaceRef.current;
      if (!ws) return;

      const binding = ws.keybindings.resolve({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });

      if (!binding) return;

      event.preventDefault();
      void ws.extensions
        .activateByEvent(`onCommand:${binding.command}`)
        .then(() => ws.commands.executeCommand(binding.command))
        .catch((err: unknown) => {
          useWebContainerStore
            .getState()
            .setError(err instanceof Error ? err.message : String(err));
        });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full flex-col bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        <header className="flex h-9 shrink-0 items-center justify-between bg-[#eaeef2] px-3 dark:bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
              {projectName ? `Project: ${projectName}` : "In-Browser IDE"}
            </span>
            {projectId ? (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {projectId.slice(0, 8)}
              </span>
            ) : null}
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
              onClick={handleExport}
              disabled={exporting}
              className="rounded px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Export Files
            </button>
            {projectId ? (
              <button
                type="button"
                onClick={handleSaveVersion}
                disabled={saving || restoring}
                className="rounded px-2 py-1 text-[12px] text-zinc-600 hover:bg-zinc-200/60 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {saving ? "Saving…" : "Save Version"}
              </button>
            ) : null}
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
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette"
              title="Command Palette (Ctrl/Cmd+Shift+P)"
              className="flex size-7 items-center justify-center rounded text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <CommandIcon className="size-4" />
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
        <CommandPalette
          commands={commands}
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
        <WindowUiHost />
      </div>
    </TooltipProvider>
  );
}
