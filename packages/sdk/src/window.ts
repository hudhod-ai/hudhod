/**
 * Window and UI contribution API types.
 *
 * @packageDocumentation
 */

import type { Disposable, Event } from "./lifecycle";

/** Severity of a notification. */
export type MessageSeverity = "info" | "warning" | "error";

/** Options for {@link WindowApi.showInputBox}. */
export interface InputBoxOptions {
  /** Dialog heading. */
  readonly title?: string;
  /** Placeholder shown while the field is empty. */
  readonly placeholder?: string;
  /** Initial field value. */
  readonly value?: string;
  /** Label for the confirm button. */
  readonly confirmLabel?: string;
  /** Return a message to block submission, or `undefined` to allow it. */
  readonly validate?: (value: string) => string | undefined;
}

/** A selectable entry in a quick pick. */
export interface QuickPickItem {
  /** Primary text. */
  readonly label: string;
  /** Secondary text shown beside the label. */
  readonly description?: string;
  /** Opaque value returned on selection. Defaults to `label`. */
  readonly value?: string;
}

/** Options for {@link WindowApi.showQuickPick}. */
export interface QuickPickOptions {
  /** Dialog heading. */
  readonly title?: string;
  /** Placeholder shown in the filter field. */
  readonly placeholder?: string;
}

/** Where a contributed panel should dock by default. */
export type PanelLocation = "left" | "right" | "bottom" | "center";

/** Options for {@link WindowApi.registerPanel}. */
export interface RegisterPanelOptions {
  /** Tab title. */
  readonly title: string;
  /**
   * Preferred dock location.
   * @defaultValue "bottom"
   */
  readonly location?: PanelLocation;
  /** Initial width in pixels, for `left` and `right` panels. */
  readonly initialWidth?: number;
  /** Initial height in pixels, for `bottom` panels. */
  readonly initialHeight?: number;
  /**
   * Open the panel as soon as it is registered.
   * @defaultValue false
   */
  readonly openImmediately?: boolean;
}

/** Options for {@link WindowApi.registerView}. */
export interface RegisterViewOptions {
  /** Header title declared by the view contribution. */
  readonly title: string;
  /** Initial width in pixels for the view's host panel. */
  readonly initialWidth?: number;
}

/**
 * Renders a contributed panel's content into a host-provided element.
 *
 * Returning a cleanup function is optional but recommended; the host calls it
 * when the panel closes.
 */
export type PanelRenderer = (
  container: HTMLElement,
) => void | (() => void) | Promise<void | (() => void)>;

/** The file currently focused in the editor. */
export interface ActiveEditor {
  /** Absolute path of the open file. */
  readonly path: string;
  /** Whether the file has unsaved changes. */
  readonly dirty: boolean;
}

/**
 * Show UI and contribute panels.
 *
 * @example
 * ```ts
 * hudhod.window.registerPanel("demo.stats", (el) => {
 *   el.textContent = "Hello from an extension panel";
 * }, { title: "Stats", location: "right" });
 * ```
 */
export interface WindowApi {
  /** Shows a transient notification. */
  showMessage(message: string, severity?: MessageSeverity): Promise<void>;

  /** Prompts for a single line of text. Resolves `undefined` if cancelled. */
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;

  /** Prompts the user to pick one item. Resolves `undefined` if cancelled. */
  showQuickPick(
    items: readonly QuickPickItem[],
    options?: QuickPickOptions,
  ): Promise<string | undefined>;

  /**
   * Contributes a panel to the workbench layout.
   * @returns A {@link Disposable} that removes the panel.
   */
  registerPanel(id: string, render: PanelRenderer, options: RegisterPanelOptions): Disposable;

  /** Supplies the body renderer for a contributed view. */
  registerView(id: string, render: PanelRenderer, options: RegisterViewOptions): Disposable;

  /** Opens a panel, or focuses it when already open. */
  openPanel(id: string): Promise<void>;

  /** Closes a panel. Resolves `false` when it was not open. */
  closePanel(id: string): Promise<boolean>;

  /** Opens a file in the editor. */
  openFile(path: string): Promise<void>;

  /** The currently focused editor, if any. */
  readonly activeEditor: ActiveEditor | undefined;

  /** Fires when editor focus moves to a different file. */
  readonly onDidChangeActiveEditor: Event<ActiveEditor | undefined>;
}
