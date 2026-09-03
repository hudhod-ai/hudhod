/**
 * A minimal dependency-injection container for workspace services.
 *
 * It is intentionally small: service identifiers are symbols, factories run
 * lazily, and disposing the registry releases created services in reverse order.
 * This is enough to make the host composition root explicit without importing a
 * framework or introducing ambient global state.
 *
 * @packageDocumentation
 */

import type { Disposable } from "@hudhod/sdk";

import { DisposableStore } from "../base/disposable";

/** A unique, typed key used to retrieve a service. */
export interface ServiceIdentifier<T> {
  /** Human-readable name used in diagnostics. */
  readonly description: string;
  /** Unique symbol backing the identifier. */
  readonly key: symbol;
  /** Type-only marker preserving `T` across calls. */
  readonly __service?: T;
}

/** Creates a typed service identifier. */
export function createServiceIdentifier<T>(description: string): ServiceIdentifier<T> {
  return { description, key: Symbol(description) };
}

type ServiceFactory<T> = (registry: ServiceRegistry) => T;

/**
 * Owns workspace-scoped services.
 *
 * @example
 * ```ts
 * const fsId = createServiceIdentifier<FileSystemService>("fs");
 * const services = new ServiceRegistry();
 * services.register(fsId, () => new FileSystemService(provider));
 * const fs = services.get(fsId);
 * ```
 */
export class ServiceRegistry implements Disposable {
  readonly #factories = new Map<symbol, ServiceFactory<unknown>>();
  readonly #instances = new Map<symbol, unknown>();
  readonly #disposables = new DisposableStore();
  #disposed = false;

  /** Registers a lazy factory for a service. */
  register<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
    this.#assertActive();
    if (this.#factories.has(identifier.key)) {
      throw new Error(`Service already registered: ${identifier.description}`);
    }
    this.#factories.set(identifier.key, factory as ServiceFactory<unknown>);
  }

  /** Retrieves and lazily creates a registered service. */
  get<T>(identifier: ServiceIdentifier<T>): T {
    this.#assertActive();
    const existing = this.#instances.get(identifier.key);
    if (existing !== undefined) return existing as T;

    const factory = this.#factories.get(identifier.key);
    if (!factory) throw new Error(`Service not registered: ${identifier.description}`);

    const instance = factory(this) as T;
    this.#instances.set(identifier.key, instance);
    if (isDisposable(instance)) this.#disposables.add(instance);
    return instance;
  }

  /** Whether a service factory is registered. */
  has(identifier: ServiceIdentifier<unknown>): boolean {
    return this.#factories.has(identifier.key);
  }

  /** Releases every created disposable service in reverse creation order. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#instances.clear();
    this.#factories.clear();
    this.#disposables.dispose();
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Service registry is disposed");
  }
}

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === "object" &&
    value !== null &&
    "dispose" in value &&
    typeof (value as { dispose?: unknown }).dispose === "function"
  );
}
