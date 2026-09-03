/**
 * The keybinding registry.
 *
 * Keybindings map key sequences to command ids. Multiple keybindings can target the
 * same command, but only one binding per key sequence is active at a time; the last
 * registration wins. Disposing a keybinding restores the previous one, tracked via a stack.
 *
 * @packageDocumentation
 */

import type { Disposable, Event, KeybindingContribution, ResolvedKeybinding } from "@hudhod/sdk";

import { createError } from "../base/errors";
import { Emitter } from "../base/event";
import { keybindingFromEvent, keybindingToString, parseKeybinding } from "./keybinding-parser";

interface StackedBinding {
  readonly contribution: KeybindingContribution;
  readonly source: "extension" | "builtin";
  readonly extensionId?: string;
}

/**
 * Registers and resolves keybindings.
 *
 * @example
 * ```ts
 * const keybindings = new KeybindingRegistry("other");
 * keybindings.registerKeybinding({
 *   command: "demo.greet",
 *   key: "ctrl+n",
 *   mac: "cmd+n",
 * });
 * const binding = await keybindings.resolve({ key: "n", ctrlKey: true, ... });
 * // => { key: "ctrl+n", command: "demo.greet", source: "extension" }
 * ```
 */
export class KeybindingRegistry implements Disposable {
  readonly #stack = new Map<string, StackedBinding[]>();
  readonly #changeEmitter = new Emitter<readonly ResolvedKeybinding[]>();
  readonly #platform: "mac" | "other";

  /** Fires whenever the keybinding catalog changes. */
  readonly onDidChangeKeybindings: Event<readonly ResolvedKeybinding[]> = (listener) =>
    this.#changeEmitter.event(listener);

  /**
   * @param platform Platform identifier. Use `"mac"` for macOS; otherwise `"other"`.
   */
  constructor(platform: "mac" | "other" = "other") {
    this.#platform = platform;
  }

  /**
   * Registers a keybinding.
   *
   * If the same key is already bound, this replaces it. Disposing the returned
   * {@link Disposable} restores the previous binding.
   *
   * @throws invalidKeybinding when the key syntax is malformed.
   */
  registerKeybinding(
    binding: KeybindingContribution,
    options?: { source?: "extension" | "builtin"; extensionId?: string },
  ): Disposable {
    try {
      const keyNormalized = parseKeybinding(binding.key);
      const macNormalized = binding.mac ? parseKeybinding(binding.mac) : undefined;

      const resolved = this.#platform === "mac" && macNormalized ? macNormalized : keyNormalized;
      const keyStr = keybindingToString(resolved);

      const source = options?.source ?? "extension";
      const stacked: StackedBinding = {
        contribution: binding,
        source,
        extensionId: options?.extensionId,
      };

      if (!this.#stack.has(keyStr)) {
        this.#stack.set(keyStr, []);
      }
      this.#stack.get(keyStr)!.push(stacked);
      this.#fireChange();

      let disposed = false;
      return {
        dispose: () => {
          if (disposed) return;
          disposed = true;
          const stack = this.#stack.get(keyStr);
          if (!stack) return;
          const idx = stack.indexOf(stacked);
          if (idx >= 0) stack.splice(idx, 1);
          if (stack.length === 0) {
            this.#stack.delete(keyStr);
          }
          this.#fireChange();
        },
      };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Resolves a keyboard event to a keybinding, if one is registered.
   *
   * @param event A keyboard event-like object with `key`, `ctrlKey`, `metaKey`, `shiftKey`, `altKey`.
   * @returns The registered keybinding, or `undefined` if no match.
   */
  resolve(event: {
    readonly key: string;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
  }): ResolvedKeybinding | undefined {
    const keyStr = keybindingFromEvent(event);
    const stack = this.#stack.get(keyStr);
    if (!stack || stack.length === 0) return undefined;

    const top = stack[stack.length - 1];
    if (!top) return undefined;

    return {
      key: keyStr,
      command: top.contribution.command,
      source: top.source,
      extensionId: top.extensionId,
    };
  }

  /** Lists all registered keybindings, with top-of-stack (most recent) entries first. */
  async getKeybindings(): Promise<ResolvedKeybinding[]> {
    const result: ResolvedKeybinding[] = [];
    for (const [keyStr, stack] of this.#stack) {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (!top) continue;

        result.push({
          key: keyStr,
          command: top.contribution.command,
          source: top.source,
          extensionId: top.extensionId,
        });
      }
    }
    return result.sort((a, b) => a.key.localeCompare(b.key));
  }

  /** Removes all registered keybindings and listeners. */
  dispose(): void {
    const changed = this.#stack.size > 0;
    this.#stack.clear();
    if (changed) this.#fireChange();
    this.#changeEmitter.dispose();
  }

  #fireChange(): void {
    void this.getKeybindings().then((bindings) => this.#changeEmitter.fire(bindings));
  }
}
