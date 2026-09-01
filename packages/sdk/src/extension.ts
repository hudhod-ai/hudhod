/**
 * Extension authoring types: manifests, activation, and lifecycle.
 *
 * @packageDocumentation
 */

import type { HudhodApi } from "./api";
import type { Disposable } from "./lifecycle";
import type { KeybindingContribution } from "./keybindings";

/**
 * When an extension should be loaded.
 *
 * - `onStartup` — activate as soon as the workbench is ready.
 * - `onCommand:<id>` — activate the first time a command is invoked.
 * - `onFileOpen:<glob>` — activate when a matching file is opened.
 * - `onView:<panelId>` — activate when a contributed panel is opened.
 *
 * Prefer lazy events over `onStartup`; every eager extension delays boot.
 */
export type ActivationEvent =
  | "onStartup"
  | `onCommand:${string}`
  | `onFileOpen:${string}`
  | `onView:${string}`;

/** A command declared statically, so the palette can list it before activation. */
export interface CommandContribution {
  /** Unique identifier, matching the id passed to `registerCommand`. */
  readonly id: string;
  /** Label shown in the command palette. */
  readonly title: string;
  /** Optional grouping shown alongside the title. */
  readonly category?: string;
}

/** A panel declared statically, so the layout can reserve a slot for it. */
export interface PanelContribution {
  /** Unique identifier, matching the id passed to `registerPanel`. */
  readonly id: string;
  /** Tab title. */
  readonly title: string;
  /**
   * Preferred dock location.
   * @defaultValue "bottom"
   */
  readonly location?: "left" | "right" | "bottom" | "center";
}

/** Static declarations an extension makes to the workbench. */
export interface Contributions {
  /** Commands the extension provides. */
  readonly commands?: readonly CommandContribution[];
  /** Panels the extension provides. */
  readonly panels?: readonly PanelContribution[];
  /** Keybindings the extension provides. */
  readonly keybindings?: readonly KeybindingContribution[];
}

/** Identity and capabilities of an extension. */
export interface ExtensionManifest {
  /** Unique identifier, conventionally `publisher.name`. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Semver version string. */
  readonly version: string;
  /** Short summary shown in extension listings. */
  readonly description?: string;
  /** Events that trigger activation. Defaults to `["onStartup"]`. */
  readonly activationEvents?: readonly ActivationEvent[];
  /** Static contributions to the workbench. */
  readonly contributes?: Contributions;
}

/**
 * Per-extension state handed to {@link Extension.activate}.
 */
export interface ExtensionContext {
  /** The manifest this extension was loaded with. */
  readonly manifest: ExtensionManifest;
  /**
   * Disposables cleaned up automatically on deactivation.
   * Push every subscription and registration here.
   */
  readonly subscriptions: Disposable[];
  /** The full host API. Identical to the module-scoped `hudhod` object. */
  readonly hudhod: HudhodApi;
}

/** The shape an extension module must export. */
export interface Extension {
  /** Describes the extension to the host. */
  readonly manifest: ExtensionManifest;
  /** Called once, when an activation event fires. */
  activate(context: ExtensionContext): void | Promise<void>;
  /** Called once, before the extension is unloaded. */
  deactivate?(): void | Promise<void>;
}

/**
 * Declares an extension with full type inference.
 *
 * This is an identity function — it exists purely so the object literal is
 * checked against {@link Extension} at the definition site rather than at the
 * point of use.
 *
 * @example
 * ```ts
 * export default defineExtension({
 *   manifest: {
 *     id: "acme.hello",
 *     name: "Hello",
 *     version: "1.0.0",
 *     activationEvents: ["onCommand:acme.hello.greet"],
 *     contributes: {
 *       commands: [{ id: "acme.hello.greet", title: "Say Hello" }],
 *     },
 *   },
 *   activate(context) {
 *     context.subscriptions.push(
 *       context.hudhod.commands.registerCommand("acme.hello.greet", () =>
 *         context.hudhod.window.showMessage("Hello!"),
 *       ),
 *     );
 *   },
 * });
 * ```
 */
export function defineExtension(extension: Extension): Extension {
  return extension;
}
