"use client";

/** UI projection helpers for the Explorer's recursive tree. */

import type { FileSystemService } from "@hudhod/core";

import type { FileTreeNode } from "@/store/useFileSystemStore";

/**
 * Builds the Explorer's nested tree from the headless file system service.
 *
 * Presentation filtering and directories-first sorting happen in
 * `FileSystemService.readDirectory`, so this layer only shapes recursion for
 * the existing Dockview Explorer component.
 */
export async function readExplorerTree(
  fs: FileSystemService,
  path = "/",
): Promise<FileTreeNode[]> {
  const entries = await fs.readDirectory(path);
  return Promise.all(
    entries.map(async (entry): Promise<FileTreeNode> => {
      if (entry.type !== "directory") {
        return { name: entry.name, path: entry.path, type: "file" };
      }
      return {
        name: entry.name,
        path: entry.path,
        type: "directory",
        children: await readExplorerTree(fs, entry.path),
      };
    }),
  );
}
