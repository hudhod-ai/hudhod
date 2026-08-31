/**
 * Command registry API types.
 *
 * @packageDocumentation
 */

import type { Disposable } from "./lifecycle";

/** A command that has been registered with the host. */
export interface CommandDescriptor {
  /** Unique identifier, conventionally `namespace.verbNoun`. */
  readonly id: string;
  /** Label shown in the command palette. */
  readonly title: string;
  /** Optional grouping shown alongside the title. */
  readonly category?: string;
  /** Identifier of the extension that contributed the command. */
  readonly extensionId?: string;
}

/** Options for {@link CommandsApi.registerCommand}. */
export interface RegisterCommandOptions {
  /**
   * Label shown in the command palette. Commands without a title are callable
   * but stay hidden from the palette.
   */
  readonly title?: string;
  /** Optional grouping shown alongside the title. */
  readonly category?: string;
}

/**
 * Register and invoke commands.
 *
 * Commands are the seam between UI affordances and behaviour: anything the
 * palette, a menu, or an agent can trigger is a command.
 *
 * @example
 * ```ts
 * context.subscriptions.push(
 *   hudhod.commands.registerCommand(
 *     "demo.formatAll",
 *     async () => { await hudhod.process.exec("npm", ["run", "fmt"]); },
 *     { title: "Format All Files", category: "Demo" },
 *   ),
 * );
 * ```
 */
export interface CommandsApi {
  /**
   * Registers a command handler.
   * @throws When `id` is already registered.
   * @returns A {@link Disposable} that unregisters the command.
   */
  registerCommand(
    id: string,
    handler: (...args: readonly unknown[]) => unknown,
    options?: RegisterCommandOptions,
  ): Disposable;

  /**
   * Invokes a registered command.
   * @throws A `CommandNotFound` error when `id` is not registered.
   */
  executeCommand<T = unknown>(id: string, ...args: readonly unknown[]): Promise<T>;

  /** Lists every registered command. */
  getCommands(): Promise<CommandDescriptor[]>;
}
