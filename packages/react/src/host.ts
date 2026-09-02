import {
  createHudhodRuntime,
  type CreateHudhodRuntimeOptions,
  type HudhodRuntime,
  type WindowUiProvider,
} from "@hudhod/core";
import type {
  ActiveEditor,
  Disposable,
  Event,
  Extension,
  InputBoxOptions,
  MessageSeverity,
  PanelRenderer,
  QuickPickItem,
  QuickPickOptions,
  RegisterPanelOptions,
  RegisterViewOptions,
} from "@hudhod/sdk";

export interface HudhodReactHostUi {
  showMessage(message: string, severity?: MessageSeverity): Promise<void>;
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  showQuickPick(
    items: readonly QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | undefined>;
  openFile(path: string): Promise<void>;
  readonly activeEditor: ActiveEditor | undefined;
  readonly onDidChangeActiveEditor: Event<ActiveEditor | undefined>;
}

export interface HudhodReactPanelController {
  openPanel(id: string): Promise<void>;
  closePanel(id: string): Promise<boolean>;
}

export interface HudhodReactRenderer {
  readonly render: PanelRenderer;
  readonly options: RegisterPanelOptions | RegisterViewOptions;
}

export interface HudhodReactHost extends HudhodRuntime {
  readonly panelRenderers: ReadonlyMap<string, HudhodReactRenderer>;
  readonly viewRenderers: ReadonlyMap<string, HudhodReactRenderer>;
  onDidChangeRenderers(listener: () => void): Disposable;
  registerExtensions(extensions: readonly Extension[]): void;
  setPanelController(controller: HudhodReactPanelController | undefined): void;
}

export interface CreateHudhodReactHostOptions extends Omit<
  CreateHudhodRuntimeOptions,
  "windowUiProvider"
> {
  readonly ui: HudhodReactHostUi;
}

/**
 * Composes a headless runtime with React renderer registration.
 *
 * The caller owns product UI through `ui`, then attaches a workbench panel controller
 * once its Dockview layout mounts.
 */
export function createHudhodReactHost(
  options: CreateHudhodReactHostOptions,
): HudhodReactHost {
  const panelRenderers = new Map<string, HudhodReactRenderer>();
  const viewRenderers = new Map<string, HudhodReactRenderer>();
  let controller: HudhodReactPanelController | undefined;
  const rendererListeners = new Set<() => void>();

  const registerRenderer = (
    renderers: Map<string, HudhodReactRenderer>,
    id: string,
    render: PanelRenderer,
    rendererOptions: RegisterPanelOptions | RegisterViewOptions,
  ): Disposable => {
    renderers.set(id, { render, options: rendererOptions });
    for (const listener of rendererListeners) listener();
    let disposed = false;
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        renderers.delete(id);
        for (const listener of rendererListeners) listener();
      },
    };
  };

  const windowUiProvider: WindowUiProvider = {
    showMessage: (message, severity) =>
      options.ui.showMessage(message, severity),
    showInputBox: (inputOptions) => options.ui.showInputBox(inputOptions),
    showQuickPick: (items, quickPickOptions) =>
      options.ui.showQuickPick(items, quickPickOptions),
    registerPanel: (id, render, panelOptions) =>
      registerRenderer(panelRenderers, id, render, panelOptions),
    registerView: (id, render, viewOptions) =>
      registerRenderer(viewRenderers, id, render, viewOptions),
    openPanel: async (id) => controller?.openPanel(id),
    closePanel: async (id) => (controller ? controller.closePanel(id) : false),
    openFile: (path) => options.ui.openFile(path),
    get activeEditor() {
      return options.ui.activeEditor;
    },
    onDidChangeActiveEditor: (listener) =>
      options.ui.onDidChangeActiveEditor(listener),
  };
  const runtime = createHudhodRuntime({ ...options, windowUiProvider });

  return {
    ...runtime,
    panelRenderers,
    viewRenderers,
    onDidChangeRenderers(listener) {
      rendererListeners.add(listener);
      return { dispose: () => rendererListeners.delete(listener) };
    },
    registerExtensions(extensions) {
      for (const extension of extensions)
        runtime.extensions.register(extension);
    },
    setPanelController(nextController) {
      controller = nextController;
    },
  };
}
