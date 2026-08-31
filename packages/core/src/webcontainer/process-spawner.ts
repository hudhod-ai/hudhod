/**
 * The WebContainer-backed {@link ProcessSpawner}.
 *
 * Browser only. Imported from `@hudhod/core/webcontainer`.
 *
 * @packageDocumentation
 */

import type { WebContainer } from "@webcontainer/api";

import type { ProcessSpawner, SpawnedProcess, SpawnerOptions } from "../process/spawner";

/**
 * Spawns processes inside a WebContainer.
 *
 * The mapping is close to one-to-one: WebContainer already exposes a merged
 * output stream, a writable stdin, and an exit promise. The only adaptation is
 * making `kill()` idempotent, which the provider contract requires.
 *
 * @example
 * ```ts
 * const spawner = new WebContainerProcessSpawner(container);
 * const processes = new ProcessService(spawner);
 * ```
 */
export class WebContainerProcessSpawner implements ProcessSpawner {
  readonly name = "webcontainer";

  readonly #container: WebContainer;

  constructor(container: WebContainer) {
    this.#container = container;
  }

  async spawn(
    command: string,
    args: readonly string[],
    options: SpawnerOptions,
  ): Promise<SpawnedProcess> {
    const process = await this.#container.spawn(command, [...args], {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: { ...options.env } } : {}),
      ...(options.terminal ? { terminal: { ...options.terminal } } : {}),
    });

    let killed = false;

    return {
      output: process.output,
      input: process.input,
      exit: process.exit,
      kill() {
        if (killed) return;
        killed = true;
        process.kill();
      },
      resize(dimensions) {
        // Only processes spawned with a terminal can be resized.
        if (!options.terminal) return;
        process.resize(dimensions);
      },
    };
  }
}
