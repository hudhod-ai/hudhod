"use client";

import { useFileSystemStore } from "@/store/useFileSystemStore";

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function EditorTabs() {
  const tabs = useFileSystemStore((state) => state.tabs);
  const activePath = useFileSystemStore((state) => state.activePath);
  const setActivePath = useFileSystemStore((state) => state.setActivePath);
  const closeFile = useFileSystemStore((state) => state.closeFile);

  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {tabs.map((tab) => {
        const name = tab.path.split("/").pop();
        const isActive = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
            onClick={() => setActivePath(tab.path)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setActivePath(tab.path);
              }
            }}
            className={`group flex cursor-pointer items-center gap-1.5 border-r border-zinc-200 pr-2 pl-3 text-xs dark:border-zinc-700 ${
              isActive
                ? "bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{name}</span>
            <button
              type="button"
              title="Close"
              onClick={(event) => {
                event.stopPropagation();
                closeFile(tab.path);
              }}
              className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-500 opacity-50 hover:bg-zinc-300/60 hover:opacity-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              {tab.dirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-current group-hover:hidden" />
              )}
              <span className={tab.dirty ? "hidden group-hover:flex" : "flex"}>
                <CloseIcon />
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
