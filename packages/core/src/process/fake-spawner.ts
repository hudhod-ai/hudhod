/**
 * A scriptable {@link ProcessSpawner} for tests.
 *
 * Shipped as part of the public API so extension authors can exercise code that
 * runs commands without needing a WebContainer.
 *
 * @packageDocumentation
 */

import type { ProcessSpawner, SpawnedProcess, SpawnerOptions } from "./spawner";

/** How a faked command should behave. */
export interface FakeCommandBehaviour {
  /** Chunks emitted on the output stream, in order. */
  readonly output?: readonly string[];
  /**
   * Exit code once the output is exhausted.
   * @defaultValue 0
   */
  readonly exitCode?: number;
  /**
   * Milliseconds to wait before exiting. The process stays running until then,
   * which is what lets timeout behaviour be tested.
   * @defaultValue 0
   */
  readonly delayMs?: number;
  /**
   * Never exit on its own. Only a `kill()` will end it. Useful for modelling
   * servers and watchers.
   * @defaultValue false
   */
  readonly neverExits?: boolean;
}

/** A record of one spawn call. */
export interface RecordedSpawn {
  /** The executable requested. */
  readonly command: string;
  /** The arguments requested. */
  readonly args: readonly string[];
  /** The options the service passed through. */
  readonly options: SpawnerOptions;
}

/** Exit code reported for a killed process. */
const KILLED_EXIT_CODE = 137;

/**
 * A spawner that replays scripted behaviour.
 *
 * @example
 * ```ts
 * const spawner = new FakeProcessSpawner();
 * spawner.register("node", { output: ["v22.0.0\n"] });
 * const { output } = await new ProcessService(spawner).exec("node", ["-v"]);
 * ```
 */
export class FakeProcessSpawner implements ProcessSpawner {
  readonly name = "fake";

  readonly #behaviours = new Map<string, FakeCommandBehaviour>();
  readonly #spawns: RecordedSpawn[] = [];
  #fallback: FakeCommandBehaviour = { output: [], exitCode: 0 };

  /** Every spawn that has been requested, in order. */
  get spawns(): readonly RecordedSpawn[] {
    return this.#spawns;
  }

  /** Scripts a command, keyed by executable name. */
  register(command: string, behaviour: FakeCommandBehaviour): this {
    this.#behaviours.set(command, behaviour);
    return this;
  }

  /** Sets the behaviour used for unregistered commands. */
  setFallback(behaviour: FakeCommandBehaviour): this {
    this.#fallback = behaviour;
    return this;
  }

  async spawn(
    command: string,
    args: readonly string[],
    options: SpawnerOptions,
  ): Promise<SpawnedProcess> {
    this.#spawns.push({ command, args: [...args], options });
    const behaviour = this.#behaviours.get(command) ?? this.#fallback;

    let killed = false;
    let onKilled: () => void = () => {};
    const killedSignal = new Promise<void>((resolve) => {
      onKilled = resolve;
    });

    const chunks = behaviour.output ?? [];
    const output = new ReadableStream<string>({
      async start(controller) {
        for (const chunk of chunks) {
          if (killed) break;
          controller.enqueue(chunk);
        }
        if (behaviour.neverExits && !killed) {
          // Hold the stream open so readers block, exactly as a server would.
          await killedSignal;
        }
        controller.close();
      },
    });

    const exit = (async (): Promise<number> => {
      if (behaviour.neverExits) {
        await killedSignal;
        return KILLED_EXIT_CODE;
      }
      if (behaviour.delayMs) {
        await Promise.race([
          new Promise((resolve) => setTimeout(resolve, behaviour.delayMs)),
          killedSignal,
        ]);
      }
      return killed ? KILLED_EXIT_CODE : (behaviour.exitCode ?? 0);
    })();

    return {
      output,
      input: new WritableStream<string>(),
      exit,
      kill() {
        if (killed) return;
        killed = true;
        onKilled();
      },
      resize() {},
    };
  }
}
