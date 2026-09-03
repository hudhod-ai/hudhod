/**
 * Built-in extension: create a new file with Ctrl+N (Cmd+N on macOS).
 */

import { defineExtension } from "@hudhod/sdk";

/**
 * Extracts the directory part of a path.
 * @example dirname("/src/index.ts") => "/src"
 * @example dirname("/") => "/"
 */
function dirname(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : trimmed.slice(0, lastSlash);
}

/**
 * Joins path components, normalizing the result.
 * @example joinPath("/src", "index.ts") => "/src/index.ts"
 * @example joinPath("/", "src") => "/src"
 */
function joinPath(base: string, relative: string): string {
  const baseEnd = base.endsWith("/") ? base.slice(0, -1) : base;
  const relStart = relative.startsWith("/") ? relative.slice(1) : relative;
  return `${baseEnd}/${relStart}`;
}

export default defineExtension({
  manifest: {
    id: "hudhod.new-file",
    name: "New File",
    version: "0.0.0",
    description: "Create a new file with Shift+N",
    activationEvents: ["onCommand:hudhod.newFile.create"],
    contributes: {
      commands: [
        {
          id: "hudhod.newFile.create",
          title: "New File",
          category: "File",
        },
      ],
      keybindings: [
        {
          command: "hudhod.newFile.create",
          key: "shift+n",
          mac: "shift+n",
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      context.hudhod.commands.registerCommand(
        "hudhod.newFile.create",
        async () => {
          const { window, fs } = context.hudhod;

          // Determine the directory: use active editor's dir or root
          let targetDir = "/";
          if (window.activeEditor) {
            targetDir = dirname(window.activeEditor.path);
          }

          // Prompt for filename
          const filename = await window.showInputBox({
            title: "New File",
            placeholder: "src/example.ts",
            validate: (value) => {
              if (!value.trim()) return "Filename cannot be empty";
              if (value.includes("..")) return "Path traversal not allowed";
              return undefined;
            },
          });

          if (!filename) return;

          // Create the file
          const fullPath = joinPath(targetDir, filename.trim());
          await fs.createFile(fullPath);

          // Refresh explorer to show the new file
          await context.hudhod.commands.executeCommand("hudhod.workbench.refreshExplorer");

          // Open it in the editor
          await window.openFile(fullPath);

          // Show success message
          await window.showMessage(`Created file: ${fullPath}`, "info");
        },
        {
          title: "New File",
          category: "File",
        },
      ),
    );
  },
});
