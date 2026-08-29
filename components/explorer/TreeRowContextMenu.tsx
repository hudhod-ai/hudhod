"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";

import type { FileTreeNode } from "@/store/useFileSystemStore";

interface TreeRowContextMenuProps {
  node: FileTreeNode;
  children: ReactNode;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (node: FileTreeNode) => void;
  onDelete: (node: FileTreeNode) => void;
}

const menuItemClass =
  "cursor-pointer rounded px-2 py-1 text-xs text-zinc-700 outline-none hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700";

export function TreeRowContextMenu({
  node,
  children,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: TreeRowContextMenuProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-800">
          {node.type === "directory" && (
            <>
              <ContextMenu.Item className={menuItemClass} onSelect={() => onNewFile(node.path)}>
                New File
              </ContextMenu.Item>
              <ContextMenu.Item className={menuItemClass} onSelect={() => onNewFolder(node.path)}>
                New Folder
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            </>
          )}
          <ContextMenu.Item className={menuItemClass} onSelect={() => onRename(node)}>
            Rename
          </ContextMenu.Item>
          <ContextMenu.Item
            className={`${menuItemClass} text-red-600 dark:text-red-400`}
            onSelect={() => onDelete(node)}
          >
            Delete
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
