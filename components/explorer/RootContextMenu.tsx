"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";

interface RootContextMenuProps {
  children: ReactNode;
  onNewFile: () => void;
  onNewFolder: () => void;
  onAddDependency: () => void;
}

const menuItemClass =
  "cursor-pointer rounded px-2 py-1 text-xs text-zinc-700 outline-none hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700";

/** Right-click menu for the empty explorer area — creates entries at the project root. */
export function RootContextMenu({
  children,
  onNewFile,
  onNewFolder,
  onAddDependency,
}: RootContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-800">
          <ContextMenu.Item className={menuItemClass} onSelect={onNewFile}>
            New File
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} onSelect={onNewFolder}>
            New Folder
          </ContextMenu.Item>
          <ContextMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={onAddDependency}
          >
            Add npm dependency…
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
