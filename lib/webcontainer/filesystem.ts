import type { FileSystemTree, WebContainer } from "@webcontainer/api";

import { useFileSystemStore, type FileTreeNode } from "@/store/useFileSystemStore";

const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist"]);

async function readDirectory(instance: WebContainer, path: string): Promise<FileTreeNode[]> {
  const entries = await instance.fs.readdir(path, { withFileTypes: true });

  const nodes = await Promise.all(
    entries
      .filter((entry) => !IGNORED_DIRECTORIES.has(entry.name))
      .map(async (entry): Promise<FileTreeNode> => {
        const entryPath = `${path}/${entry.name}`.replace(/^\/\//, "/");
        if (entry.isDirectory()) {
          return {
            name: entry.name,
            path: entryPath,
            type: "directory",
            children: await readDirectory(instance, entryPath),
          };
        }
        return { name: entry.name, path: entryPath, type: "file" };
      }),
  );

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Rebuilds the Explorer tree from the current WebContainer file system state. */
export async function refreshTree(instance: WebContainer): Promise<void> {
  const tree = await readDirectory(instance, "/");
  useFileSystemStore.getState().setTree(tree);
}

export async function readTextFile(instance: WebContainer, path: string): Promise<string> {
  return instance.fs.readFile(path, "utf-8");
}

export async function writeTextFile(
  instance: WebContainer,
  path: string,
  content: string,
): Promise<void> {
  await instance.fs.writeFile(path, content);
}

export async function createEntry(
  instance: WebContainer,
  path: string,
  type: "file" | "directory",
): Promise<void> {
  if (type === "directory") {
    await instance.fs.mkdir(path, { recursive: true });
  } else {
    await instance.fs.writeFile(path, "");
  }
  await refreshTree(instance);
}

export async function deleteEntry(instance: WebContainer, path: string): Promise<void> {
  await instance.fs.rm(path, { recursive: true, force: true });
  useFileSystemStore.getState().removeOpenTabsUnderPath(path);
  await refreshTree(instance);
}

export async function renameEntry(
  instance: WebContainer,
  oldPath: string,
  newPath: string,
): Promise<void> {
  await instance.fs.rename(oldPath, newPath);
  useFileSystemStore.getState().renameOpenTab(oldPath, newPath);
  await refreshTree(instance);
}

/** Returns a FileSystemTree so the snapshot stays readable outside WebContainer. */
export async function exportFileSystem(
  instance: WebContainer,
  path = instance.workdir,
): Promise<FileSystemTree> {
  return instance.export(path, {
    format: "json",
    excludes: [...IGNORED_DIRECTORIES, ".mcp-use", "package-lock.json"].flatMap((entry) => [
      entry,
      `**/${entry}`,
      `**/${entry}/**`,
    ]),
  });
}

export async function mountAndIndex(
  instance: WebContainer,
  tree: Parameters<WebContainer["mount"]>[0],
): Promise<void> {
  await instance.mount(tree);
  await refreshTree(instance);
}
