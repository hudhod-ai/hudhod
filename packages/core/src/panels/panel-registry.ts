/**
 * The panel registry.
 *
 * Tracks panel metadata contributed through extension manifests so the UI can list
 * panels before their owning extension activates. Only one panel per id is active at
 * a time; the last registration wins. Disposing a panel restores the previous one,
 * tracked via a stack.
 *
 * This is core-internal bookkeeping and is deliberately absent from `HudhodApi`:
 * extensions declare panels in their manifest and supply renderers through
 * `hudhod.window.registerPanel`.
 *
 * @packageDocumentation
 */

import type { Disposable, Event, PanelContribution } from "@hudhod/sdk";

import { Emitter } from "../base/event";

/** Resolved metadata for a contributed panel. */
export interface PanelInfo {
  /** Unique identifier, matching the id passed to `registerPanel`. */
  readonly id: string;
  /** Tab title. */
  readonly title: string;
  /** Opaque icon value supplied by the manifest contribution. */
  readonly icon?: unknown;
  /** Dock location, defaulted to `"bottom"` when the contribution omits it. */
  readonly location: "left" | "right" | "bottom" | "center";
  /** Whether the panel comes from an extension or the built-in shell. */
  readonly source: "extension" | "builtin";
  /** Id of the owning extension, when the source is an extension. */
  readonly extensionId?: string;
}

/**
 * Registers and lists contributed panels.
 *
 * @example
 * ```ts
 * const panels = new PanelRegistry();
 * const sub = panels.registerPanel(
 *   { id: "demo.logs", title: "Logs" },
 *   { extensionId: "demo" },
 * );
 * panels.getPanels();
 * // => [{ id: "demo.logs", title: "Logs", location: "bottom", source: "extension", extensionId: "demo" }]
 * sub.dispose();
 * ```
 */
export class PanelRegistry implements Disposable {
  readonly #stack = new Map<string, PanelInfo[]>();
  readonly #changeEmitter = new Emitter<readonly PanelInfo[]>();

  /** Fires whenever the panel catalog changes. */
  readonly onDidChangePanels: Event<readonly PanelInfo[]> = (listener) =>
    this.#changeEmitter.event(listener);

  /**
   * Registers a panel contribution.
   *
   * If the same id is already registered, this replaces it. Disposing the returned
   * {@link Disposable} restores the previous registration.
   */
  registerPanel(
    contribution: PanelContribution,
    options?: { source?: "extension" | "builtin"; extensionId?: string },
  ): Disposable {
    const info: PanelInfo = {
      id: contribution.id,
      title: contribution.title,
      icon: contribution.icon,
      location: contribution.location ?? "bottom",
      source: options?.source ?? "extension",
      extensionId: options?.extensionId,
    };

    let stack = this.#stack.get(info.id);
    if (!stack) {
      stack = [];
      this.#stack.set(info.id, stack);
    }
    stack.push(info);
    this.#fireChange();

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        const current = this.#stack.get(info.id);
        if (!current) return;
        const idx = current.indexOf(info);
        if (idx >= 0) current.splice(idx, 1);
        if (current.length === 0) {
          this.#stack.delete(info.id);
        }
        this.#fireChange();
      },
    };
  }

  /** Lists the active panel per id, sorted by id for stable UI ordering. */
  getPanels(): readonly PanelInfo[] {
    const result: PanelInfo[] = [];
    for (const stack of this.#stack.values()) {
      const top = stack[stack.length - 1];
      if (top) result.push(top);
    }
    // oxlint-disable-next-line unicorn/no-array-sort -- Array#toSorted is not available in the active TypeScript lib.
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Removes all registered panels and listeners. */
  dispose(): void {
    const changed = this.#stack.size > 0;
    this.#stack.clear();
    if (changed) this.#fireChange();
    this.#changeEmitter.dispose();
  }

  #fireChange(): void {
    this.#changeEmitter.fire(this.getPanels());
  }
}
