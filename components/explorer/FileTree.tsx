"use client";

import { useState } from "react";
import { getWebContainer } from "@/lib/webcontainer/boot";
import {
  createEntry,
  deleteEntry,
  readTextFile,
  renameEntry,
} from "@/lib/webcontainer/filesystem";
import { addDependency } from "@/lib/webcontainer/process";
import {
  useFileSystemStore,
  type FileTreeNode,
} from "@/store/useFileSystemStore";
import { InputDialog } from "@/components/ui/InputDialog";
import { FileTreeNodeRow } from "./FileTreeNodeRow";
import { RootContextMenu } from "./RootContextMenu";

type PendingDialog =
  | { kind: "new-file" | "new-folder"; parentPath: string }
  | { kind: "rename"; node: FileTreeNode }
  | { kind: "add-dependency" }
  | null;

export function FileTree() {
  const tree = useFileSystemStore((state) => state.tree);
  const activePath = useFileSystemStore((state) => state.activePath);
  const openFile = useFileSystemStore((state) => state.openFile);
  const [pendingDialog, setPendingDialog] = useState<PendingDialog>(null);

  async function handleOpenFile(path: string) {
    const instance = await getWebContainer();
    const content = await readTextFile(instance, path);
    openFile(path, content);
  }

  async function handleDelete(node: FileTreeNode) {
    const instance = await getWebContainer();
    await deleteEntry(instance, node.path);
  }

  function joinPath(parentPath: string, name: string) {
    return parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
  }

  async function handleDialogSubmit(value: string) {
    if (!pendingDialog) return;
    const instance = await getWebContainer();

    if (
      pendingDialog.kind === "new-file" ||
      pendingDialog.kind === "new-folder"
    ) {
      const path = joinPath(pendingDialog.parentPath, value);
      await createEntry(
        instance,
        path,
        pendingDialog.kind === "new-file" ? "file" : "directory",
      );
    } else if (pendingDialog.kind === "rename") {
      const parent =
        pendingDialog.node.path.slice(
          0,
          pendingDialog.node.path.lastIndexOf("/"),
        ) || "/";
      await renameEntry(
        instance,
        pendingDialog.node.path,
        joinPath(parent, value),
      );
    } else if (pendingDialog.kind === "add-dependency") {
      await addDependency(instance, value);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* <div className="border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
        <span className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Explorer
        </span>
      </div> */}
      <RootContextMenu
        onNewFile={() =>
          setPendingDialog({ kind: "new-file", parentPath: "/" })
        }
        onNewFolder={() =>
          setPendingDialog({ kind: "new-folder", parentPath: "/" })
        }
        onAddDependency={() => setPendingDialog({ kind: "add-dependency" })}
      >
        <div className="flex-1 overflow-auto py-1">
          {tree.map((node) => (
            <FileTreeNodeRow
              key={node.path}
              node={node}
              depth={0}
              activePath={activePath}
              onOpenFile={handleOpenFile}
              onNewFile={(parentPath) =>
                setPendingDialog({ kind: "new-file", parentPath })
              }
              onNewFolder={(parentPath) =>
                setPendingDialog({ kind: "new-folder", parentPath })
              }
              onRename={(node) => setPendingDialog({ kind: "rename", node })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </RootContextMenu>

      <InputDialog
        open={pendingDialog !== null}
        onOpenChange={(open) => !open && setPendingDialog(null)}
        title={
          pendingDialog?.kind === "rename"
            ? "Rename"
            : pendingDialog?.kind === "add-dependency"
              ? "Add npm dependency"
              : pendingDialog?.kind === "new-folder"
                ? "New Folder"
                : "New File"
        }
        label={
          pendingDialog?.kind === "add-dependency" ? "Package name" : "Name"
        }
        submitLabel={
          pendingDialog?.kind === "add-dependency" ? "Install" : "Create"
        }
        defaultValue={
          pendingDialog?.kind === "rename" ? pendingDialog.node.name : ""
        }
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
