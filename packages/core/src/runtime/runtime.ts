import type { HudhodApi, TerminalApi, WorkspaceApi } from "@hudhod/sdk";

import { CommandRegistry } from "../commands/command-registry";
import { DiffService } from "../diff/diff-service";
import { InProcessExtensionHost } from "../extensions/extension-host";
import { FileSystemService } from "../fs/file-system-service";
import type { FileSystemProvider } from "../fs/provider";
import { KeybindingRegistry } from "../keybindings/keybinding-registry";
import { PanelRegistry } from "../panels/panel-registry";
import { ProcessService } from "../process/process-service";
import type { ProcessSpawner } from "../process/spawner";
import { SearchService } from "../search/search-service";
import { ViewRegistry } from "../views/view-registry";
import { WindowService } from "../window/window-service";
import type { WindowUiProvider } from "../window/window-service";

export interface HudhodRuntime {
  readonly fs: FileSystemService;
  readonly search: SearchService;
  readonly diff: DiffService;
  readonly process: ProcessService;
  readonly commands: CommandRegistry;
  readonly keybindings: KeybindingRegistry;
  readonly panels: PanelRegistry;
  readonly views: ViewRegistry;
  readonly window: WindowService;
  readonly extensions: InProcessExtensionHost;
  readonly api: HudhodApi;
  dispose(): void;
}

export interface CreateHudhodRuntimeOptions {
  readonly fileSystemProvider: FileSystemProvider;
  readonly processSpawner: ProcessSpawner;
  readonly windowUiProvider: WindowUiProvider;
  readonly platform?: "mac" | "other";
  readonly version?: string;
  readonly workspace?: WorkspaceApi;
  readonly terminal?: TerminalApi;
}

const unavailableWorkspace: WorkspaceApi = {
  rootPath: "/",
  async applyEdit() {
    throw new Error("Workspace API is not configured");
  },
  async revertEdit() {
    throw new Error("Workspace API is not configured");
  },
  async editHistory() {
    return [];
  },
  onDidApplyEdit: () => ({ dispose() {} }),
};

const unavailableTerminal: TerminalApi = {
  async create() {
    throw new Error("Terminal API is not configured");
  },
  terminals: [],
  onDidOpenTerminal: () => ({ dispose() {} }),
  onDidCloseTerminal: () => ({ dispose() {} }),
};

/** Creates an environment-agnostic Hudhod runtime from host-provided adapters. */
export function createHudhodRuntime(options: CreateHudhodRuntimeOptions): HudhodRuntime {
  const fs = new FileSystemService(options.fileSystemProvider);
  const process = new ProcessService(options.processSpawner);
  const commands = new CommandRegistry();
  const keybindings = new KeybindingRegistry(options.platform ?? "other");
  const panels = new PanelRegistry();
  const views = new ViewRegistry();
  const window = new WindowService(options.windowUiProvider);
  const search = new SearchService(fs);
  const diff = new DiffService(fs);
  const api: HudhodApi = {
    version: options.version ?? "0.1.0",
    fs,
    workspace: options.workspace ?? unavailableWorkspace,
    search,
    diff,
    process,
    terminal: options.terminal ?? unavailableTerminal,
    commands,
    keybindings,
    window,
  };
  const extensions = new InProcessExtensionHost(api, { panels, views });
  let disposed = false;

  return {
    fs,
    search,
    diff,
    process,
    commands,
    keybindings,
    panels,
    views,
    window,
    extensions,
    api,
    dispose() {
      if (disposed) return;
      disposed = true;
      extensions.dispose();
      window.dispose();
      views.dispose();
      panels.dispose();
      keybindings.dispose();
      commands.dispose();
      process.dispose();
      fs.dispose();
    },
  };
}
