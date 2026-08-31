/**
 * Terminal API types.
 *
 * @packageDocumentation
 */

import type { Disposable, Event } from "./lifecycle";

/** Options for {@link TerminalApi.create}. */
export interface CreateTerminalOptions {
  /**
   * Tab title.
   * @defaultValue "Terminal"
   */
  readonly name?: string;
  /**
   * Working directory.
   * @defaultValue The workspace root.
   */
  readonly cwd?: string;
}

/** A shell session backed by a real pseudo-terminal. */
export interface Terminal extends Disposable {
  /** Host-assigned identifier, unique for the session. */
  readonly id: string;
  /** Tab title. */
  readonly name: string;
  /** Writes text to the terminal's stdin. */
  sendText(text: string, addNewline?: boolean): Promise<void>;
  /** Brings the terminal's panel to the foreground. */
  show(): Promise<void>;
}

/**
 * Create and control interactive shells.
 *
 * @example
 * ```ts
 * const term = await hudhod.terminal.create({ name: "Build" });
 * await term.sendText("npm run build");
 * ```
 */
export interface TerminalApi {
  /** Opens a new shell session. */
  create(options?: CreateTerminalOptions): Promise<Terminal>;

  /** Every terminal currently open. */
  readonly terminals: readonly Terminal[];

  /** Fires when a terminal is created. */
  readonly onDidOpenTerminal: Event<Terminal>;

  /** Fires when a terminal is disposed. */
  readonly onDidCloseTerminal: Event<Terminal>;
}
