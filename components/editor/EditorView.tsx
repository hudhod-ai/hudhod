"use client";

import { useEffect, useRef } from "react";

import { useColorMode } from "@/hooks/useColorMode";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { writeTextFile } from "@/lib/webcontainer/filesystem";
import { useFileSystemStore } from "@/store/useFileSystemStore";

import { EditorTabs } from "./EditorTabs";
import { MonacoEditor } from "./MonacoEditor";

const SAVE_DEBOUNCE_MS = 400;

export function EditorView() {
  const tabs = useFileSystemStore((state) => state.tabs);
  const activePath = useFileSystemStore((state) => state.activePath);
  const updateContent = useFileSystemStore((state) => state.updateContent);
  const markSaved = useFileSystemStore((state) => state.markSaved);
  const { mode } = useColorMode();
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const activeTab = tabs.find((tab) => tab.path === activePath);

  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function handleChange(path: string, content: string) {
    updateContent(path, content);

    const timers = saveTimers.current;
    const existingTimer = timers.get(path);
    if (existingTimer) clearTimeout(existingTimer);

    timers.set(
      path,
      setTimeout(async () => {
        const instance = await getWebContainer();
        await writeTextFile(instance, path, content);
        markSaved(path);
        timers.delete(path);
      }, SAVE_DEBOUNCE_MS),
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <MonacoEditor
            path={activeTab.path}
            value={activeTab.content}
            theme={mode}
            onChange={(content) => handleChange(activeTab.path, content)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Select a file from the Explorer to start editing.
          </div>
        )}
      </div>
    </div>
  );
}
