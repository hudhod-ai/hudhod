"use client";

import {
  ChevronDown,
  ChevronRight,
  File,
  FileJson,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";

import type { FileTreeNode } from "@/store/useFileSystemStore";

import { TreeRowContextMenu } from "./TreeRowContextMenu";

interface FileTreeNodeRowProps {
  node: FileTreeNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (node: FileTreeNode) => void;
  onDelete: (node: FileTreeNode) => void;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "json":
      return <FileJson size={14} className="text-amber-500" />;
    case "ts":
    case "tsx":
      return <FileCode size={14} className="text-blue-500" />;
    case "js":
    case "jsx":
      return <FileCode size={14} className="text-yellow-500" />;
    case "css":
      return <FileCode size={14} className="text-sky-500" />;
    case "md":
      return <FileText size={14} className="text-zinc-400" />;
    default:
      return <File size={14} className="text-zinc-400" />;
  }
}

export function FileTreeNodeRow({
  node,
  depth,
  activePath,
  onOpenFile,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: FileTreeNodeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.type === "directory";
  const isActive = node.path === activePath;

  return (
    <div>
      <TreeRowContextMenu
        node={node}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onRename={onRename}
        onDelete={onDelete}
      >
        <button
          type="button"
          onClick={() =>
            isDirectory ? setExpanded((prev) => !prev) : onOpenFile(node.path)
          }
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`flex w-full appearance-none items-center gap-1.5 border-0 bg-transparent py-0.75 pr-2 text-left text-xs outline-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            isActive
              ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span className="flex w-3 shrink-0 items-center justify-center text-zinc-400">
            {isDirectory ? (
              expanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )
            ) : null}
          </span>
          <span className="flex shrink-0 items-center text-amber-500">
            {isDirectory ? (
              expanded ? (
                <FolderOpen size={14} />
              ) : (
                <Folder size={14} />
              )
            ) : (
              <FileIcon name={node.name} />
            )}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
      </TreeRowContextMenu>
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpenFile={onOpenFile}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
