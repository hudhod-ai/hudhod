/**
 * First-party, in-process extension host.
 *
 * The host has no dependency on React, Dockview, Monaco, or WebContainer. Those
 * concerns are supplied through the injected {@link HudhodApi}; consequently,
 * the host can be unit tested in Node and could later be replaced by an RPC host
 * without changing extension author code.
 *
 * @packageDocumentation
 */

import type {
  ActivationEvent,
  Disposable,
  Extension,
  ExtensionContext,
  ExtensionManifest,
  HudhodApi,
} from "@hudhod/sdk";

import { DisposableStore } from "../base/disposable";
import type { PanelRegistry } from "../panels/panel-registry";
import type { ViewRegistry } from "../views/view-registry";
import { parseExtensionManifest } from "./manifest";

/** Current lifecycle state of a registered extension. */
export type ExtensionStatus = "registered" | "activating" | "active" | "failed";

/** A serializable snapshot of a registered extension. */
export interface ExtensionInfo {
  /** Validated extension manifest. */
  readonly manifest: ExtensionManifest;
  /** Current lifecycle state. */
  readonly status: ExtensionStatus;
  /** Activation error message when status is `failed`. */
  readonly error?: string;
}

interface RegisteredExtension {
  readonly extension: Extension;
  readonly manifest: ExtensionManifest;
  readonly subscriptions: DisposableStore;
  status: ExtensionStatus;
  error?: string;
  activatePromise?: Promise<void>;
}

/**
 * Loads and activates trusted, first-party extensions.
 *
 * The host deliberately does not sandbox code or impose permissions: hudhod's
 * current extension model is curated and first-party. Activation is deduplicated
 * so concurrent triggers only call an extension's `activate` method once.
 *
 * @example
 * ```ts
 * const host = new InProcessExtensionHost(hudhod, { panels, views });
 * host.register(extension);
 * await host.activateByEvent("onStartup");
 * ```
 */
export class InProcessExtensionHost implements Disposable {
  readonly #hudhod: HudhodApi;
  readonly #panels: PanelRegistry;
  readonly #views: ViewRegistry;
  readonly #extensions = new Map<string, RegisteredExtension>();
  #disposed = false;

  constructor(
    hudhod: HudhodApi,
    registries: { panels: PanelRegistry; views: ViewRegistry },
  ) {
    this.#hudhod = hudhod;
    this.#panels = registries.panels;
    this.#views = registries.views;
  }

  /**
   * Registers an extension without running its activation hook.
   *
   * Contributed keybindings and panels are registered immediately so they can be
   * discovered before the extension's activate hook runs, enabling lazy activation.
   *
   * @throws `ZodError` when the manifest is malformed.
   * @throws `Error` when another extension already owns the same id.
   */
  register(extension: Extension): Disposable {
    this.#assertActive();
    const manifest = parseExtensionManifest(extension.manifest);
    if (this.#extensions.has(manifest.id)) {
      throw new Error(`Extension is already registered: ${manifest.id}`);
    }

    const registered: RegisteredExtension = {
      extension,
      manifest,
      subscriptions: new DisposableStore(),
      status: "registered",
    };

    // Register contributed keybindings immediately (lazy activation support)
    const keybindings = manifest.contributes?.keybindings ?? [];
    for (const kb of keybindings) {
      const disp = this.#hudhod.keybindings.registerKeybinding(kb);
      registered.subscriptions.add(disp);
    }

    // Panel metadata is registered up front; renderers arrive on activation.
    const panels = manifest.contributes?.panels ?? [];
    for (const panel of panels) {
      const disp = this.#panels.registerPanel(panel, {
        source: "extension",
        extensionId: manifest.id,
      });
      registered.subscriptions.add(disp);
    }

    const viewContainers = manifest.contributes?.viewContainers ?? [];
    for (const container of viewContainers) {
      const disp = this.#panels.registerPanel(container, {
        source: "extension",
        extensionId: manifest.id,
      });
      registered.subscriptions.add(disp);
    }

    const views = manifest.contributes?.views ?? [];
    for (const view of views) {
      const disp = this.#views.registerView(view, {
        source: "extension",
        extensionId: manifest.id,
      });
      registered.subscriptions.add(disp);
    }

    this.#extensions.set(manifest.id, registered);

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        // Contributions registered before activation still need releasing when
        // the extension never activated, in which case `deactivate` is a no-op.
        if (registered.status === "registered") {
          registered.subscriptions.dispose();
        } else {
          void this.deactivate(manifest.id);
        }
        this.#extensions.delete(manifest.id);
      },
    };
  }

  /** Lists registered extensions without exposing mutable host state. */
  getExtensions(): readonly ExtensionInfo[] {
    return Array.from(this.#extensions.values(), (registered) =>
      registered.error
        ? {
            manifest: registered.manifest,
            status: registered.status,
            error: registered.error,
          }
        : {
            manifest: registered.manifest,
            status: registered.status,
          },
    );
  }

  /** Activates every extension that declared `event`. */
  async activateByEvent(event: ActivationEvent): Promise<void> {
    this.#assertActive();
    const matching = [...this.#extensions.values()].filter((registered) =>
      (registered.manifest.activationEvents ?? ["onStartup"]).includes(event),
    );
    await Promise.all(matching.map((registered) => this.#activate(registered)));
  }

  /** Activates one extension by id. */
  async activate(extensionId: string): Promise<void> {
    this.#assertActive();
    const registered = this.#extensions.get(extensionId);
    if (!registered)
      throw new Error(`Extension is not registered: ${extensionId}`);
    await this.#activate(registered);
  }

  /** Deactivates one extension and releases its registered resources. */
  async deactivate(extensionId: string): Promise<boolean> {
    const registered = this.#extensions.get(extensionId);
    if (!registered || registered.status === "registered") return false;

    try {
      await registered.extension.deactivate?.();
    } finally {
      registered.subscriptions.dispose();
      registered.status = "registered";
      registered.error = undefined;
      registered.activatePromise = undefined;
    }
    return true;
  }

  /** Deactivates every extension and blocks further registration. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const [id] of this.#extensions) {
      void this.deactivate(id);
    }
    this.#extensions.clear();
  }

  async #activate(registered: RegisteredExtension): Promise<void> {
    if (registered.status === "active") return;
    if (registered.activatePromise) return registered.activatePromise;

    registered.status = "activating";
    registered.activatePromise = (async () => {
      try {
        const subscriptions: Disposable[] = [];
        const push = subscriptions.push.bind(subscriptions);
        subscriptions.push = (...items: Disposable[]): number => {
          for (const item of items) registered.subscriptions.add(item);
          return push(...items);
        };
        const context: ExtensionContext = {
          manifest: registered.manifest,
          subscriptions,
          hudhod: this.#hudhod,
        };
        await registered.extension.activate(context);
        registered.status = "active";
      } catch (error) {
        registered.status = "failed";
        registered.error =
          error instanceof Error ? error.message : String(error);
        registered.subscriptions.dispose();
        throw error;
      } finally {
        registered.activatePromise = undefined;
      }
    })();

    return registered.activatePromise;
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Extension host is disposed");
  }
}
