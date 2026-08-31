/**
 * The command registry.
 *
 * Commands are the common dispatch layer between UI controls, the command
 * palette, AI agents, and extensions. It contains no UI assumptions; frontends
 * subscribe to {@link onDidChangeCommands} to render a palette or menu.
 *
 * @packageDocumentation
 */

import type {
  CommandDescriptor,
  CommandsApi,
  Disposable,
  Event,
  RegisterCommandOptions,
} from "@hudhod/sdk";

import { createError } from "../base/errors";
import { Emitter } from "../base/event";

interface RegisteredCommand {
  readonly descriptor: CommandDescriptor;
  readonly handler: (...args: readonly unknown[]) => unknown;
}

/**
 * Registers and invokes commands.
 *
 * @example
 * ```ts
 * const commands = new CommandRegistry();
 * commands.registerCommand("demo.hello", () => "Hello", { title: "Say Hello" });
 * await commands.executeCommand("demo.hello");
 * ```
 */
export class CommandRegistry implements CommandsApi, Disposable {
  readonly #commands = new Map<string, RegisteredCommand>();
  readonly #changeEmitter = new Emitter<readonly CommandDescriptor[]>();

  /** Fires whenever the command catalog changes. */
  readonly onDidChangeCommands: Event<readonly CommandDescriptor[]> = (
    listener,
  ) => this.#changeEmitter.event(listener);

  /**
   * Registers a command handler.
   *
   * @throws A `CommandExists` error when `id` is already registered.
   */
  registerCommand(
    id: string,
    handler: (...args: readonly unknown[]) => unknown,
    options: RegisterCommandOptions = {},
  ): Disposable {
    if (this.#commands.has(id)) {
      throw createError(
        "CommandExists",
        `Command is already registered: ${id}`,
      );
    }

    const descriptor: CommandDescriptor = {
      id,
      ...(options.title ? { title: options.title } : { title: id }),
      ...(options.category ? { category: options.category } : {}),
    };
    const registered: RegisteredCommand = { descriptor, handler };
    this.#commands.set(id, registered);
    this.#fireChange();

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (this.#commands.get(id) !== registered) return;
        this.#commands.delete(id);
        this.#fireChange();
      },
    };
  }

  /**
   * Invokes a registered command.
   *
   * @throws A `CommandNotFound` error when no handler is registered for `id`.
   */
  async executeCommand<T = unknown>(
    id: string,
    ...args: readonly unknown[]
  ): Promise<T> {
    const command = this.#commands.get(id);
    if (!command) {
      throw createError("CommandNotFound", `Command not found: ${id}`);
    }
    return (await command.handler(...args)) as T;
  }

  /** Lists registered commands, alphabetically by title then id. */
  async getCommands(): Promise<CommandDescriptor[]> {
    return [...this.#commands.values()]
      .map(({ descriptor }) => ({ ...descriptor }))
      .sort(
        (left, right) =>
          left.title.localeCompare(right.title) ||
          left.id.localeCompare(right.id),
      );
  }

  /** Removes all registered commands and listeners. */
  dispose(): void {
    const changed = this.#commands.size > 0;
    this.#commands.clear();
    if (changed) this.#fireChange();
    this.#changeEmitter.dispose();
  }

  #fireChange(): void {
    void this.getCommands().then((commands) =>
      this.#changeEmitter.fire(commands),
    );
  }
}
