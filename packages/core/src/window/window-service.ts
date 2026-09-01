/**
 * Window service implementation backed by a host-supplied UI provider.
 *
 * @packageDocumentation
 */

import type {
  ActiveEditor,
  Disposable,
  Event,
  InputBoxOptions,
  MessageSeverity,
  QuickPickItem,
  QuickPickOptions,
  RegisterPanelOptions,
  WindowApi,
  PanelRenderer,
} from "@hudhod/sdk";

import { createError } from "../base/errors";
import { Emitter } from "../base/event";

/**
 * Host-supplied implementation of UI operations.
 *
 * The service delegates all UI interactions to this provider, allowing the host
 * to supply React components, native dialogs, or any other UI implementation.
 */
export interface WindowUiProvider {
  showMessage(message: string, severity?: MessageSeverity): Promise<void>;
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;
  showQuickPick(
    items: readonly QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | undefined>;
  registerPanel(
    id: string,
    render: PanelRenderer,
    options: RegisterPanelOptions,
  ): Disposable;
  openPanel(id: string): Promise<void>;
  closePanel(id: string): Promise<boolean>;
  openFile(path: string): Promise<void>;
  readonly activeEditor: ActiveEditor | undefined;
  readonly onDidChangeActiveEditor: Event<ActiveEditor | undefined>;
}

/**
 * Provides window and UI APIs to extensions.
 *
 * @example
 * ```ts
 * const provider = createMyWindowUiProvider();
 * const window = new WindowService(provider);
 * await window.showMessage("Hello!");
 * ```
 */
export class WindowService implements WindowApi, Disposable {
  readonly #provider: WindowUiProvider;

  constructor(provider: WindowUiProvider) {
    this.#provider = provider;
  }

  async showMessage(
    message: string,
    severity?: MessageSeverity,
  ): Promise<void> {
    return this.#provider.showMessage(message, severity);
  }

  async showInputBox(options?: InputBoxOptions): Promise<string | undefined> {
    return this.#provider.showInputBox(options);
  }

  async showQuickPick(
    items: readonly QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | undefined> {
    return this.#provider.showQuickPick(items, options);
  }

  registerPanel(
    id: string,
    render: PanelRenderer,
    options: RegisterPanelOptions,
  ): Disposable {
    return this.#provider.registerPanel(id, render, options);
  }

  async openPanel(id: string): Promise<void> {
    return this.#provider.openPanel(id);
  }

  async closePanel(id: string): Promise<boolean> {
    return this.#provider.closePanel(id);
  }

  async openFile(path: string): Promise<void> {
    return this.#provider.openFile(path);
  }

  get activeEditor(): ActiveEditor | undefined {
    return this.#provider.activeEditor;
  }

  get onDidChangeActiveEditor(): Event<ActiveEditor | undefined> {
    return this.#provider.onDidChangeActiveEditor;
  }

  dispose(): void {
    // No-op: provider lifecycle is managed by the host
  }
}
