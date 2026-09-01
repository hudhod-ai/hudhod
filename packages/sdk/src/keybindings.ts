/**
 * Keybinding contribution types and API.
 *
 * @packageDocumentation
 */

import type { Disposable } from "./lifecycle";

/**
 * A keybinding declared statically by an extension, binding a key sequence to a command.
 *
 * @example
 * ```ts
 * { command: "hudhod.newFile.create", key: "ctrl+n", mac: "cmd+n" }
 * ```
 */
export interface KeybindingContribution {
  /** The command id to invoke. */
  readonly command: string;
  /** Key sequence (e.g. `"ctrl+n"`, `"ctrl+shift+p"`). Modifiers: `ctrl`, `shift`, `alt`, `cmd`/`meta`. */
  readonly key: string;
  /** Optional macOS-specific override. Defaults to `key` on mac if not provided. */
  readonly mac?: string;
}

/**
 * A resolved keybinding after conflict resolution and platform normalization.
 *
 * Multiple extensions may contribute the same key; the last registration wins.
 */
export interface ResolvedKeybinding {
  /** The normalized key sequence for the current platform. */
  readonly key: string;
  /** The command id to invoke. */
  readonly command: string;
  /** Where the keybinding came from. */
  readonly source: "extension" | "builtin";
  /** The extension id if source is `"extension"`. */
  readonly extensionId?: string;
}

/**
 * Register and resolve keybindings.
 */
export interface KeybindingsApi {
  /**
   * Registers a keybinding.
   *
   * If the same `key` is already bound, the new binding replaces the old one.
   * Return the {@link Disposable} to restore the previous binding when disposed.
   */
  registerKeybinding(binding: KeybindingContribution): Disposable;

  /** Lists all registered keybindings. */
  getKeybindings(): Promise<ResolvedKeybinding[]>;
}
