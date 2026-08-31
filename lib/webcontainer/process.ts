import type { ProcessHandle } from "@hudhod/sdk";
import type { WebContainer } from "@webcontainer/api";

import { getHudhodWorkspace } from "@/lib/hudhod/workspace";

import { createLineBuffer } from "./logLineBuffer";

/** Callbacks through which a UI projects workspace task state. */
export interface WebContainerTaskHandlers {
  /** Receives complete output lines from an install or dev task. */
  onLog(source: "install" | "dev", message: string): void;
  /** Receives incomplete progress output, such as a package-manager spinner. */
  onLogProgress(source: "install" | "dev", message: string): void;
  /** Publishes task lifecycle state. */
  onStatusChange(status: "installing" | "starting"): void;
  /** Publishes the current dev-server handle. */
  onDevProcess(process: ProcessHandle | null): void;
}

const devProcesses = new WeakMap<WebContainer, ProcessHandle>();

async function pipeOutputToLogs(
  process: ProcessHandle,
  source: "install" | "dev",
  handlers: WebContainerTaskHandlers,
): Promise<void> {
  const lineBuffer = createLineBuffer(
    (line) => handlers.onLog(source, line),
    (partial) => handlers.onLogProgress(source, partial),
  );
  await process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        lineBuffer.push(chunk);
      },
      close() {
        lineBuffer.flush();
      },
    }),
  );
}

/** Runs npm install, streaming output through injected UI handlers. */
export async function runInstall(
  instance: WebContainer,
  handlers: WebContainerTaskHandlers,
): Promise<void> {
  handlers.onStatusChange("installing");
  const installProcess = await getHudhodWorkspace(instance).processes.spawn(
    "npm",
    ["install"],
  );
  void pipeOutputToLogs(installProcess, "install", handlers);
  const exitCode = await installProcess.exit;
  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}`);
  }
}

/** Starts npm run dev and records the task independently of the UI store. */
export async function runDev(
  instance: WebContainer,
  handlers: WebContainerTaskHandlers,
): Promise<void> {
  handlers.onStatusChange("starting");
  const devProcess = await getHudhodWorkspace(instance).processes.spawn("npm", [
    "run",
    "dev",
  ]);
  devProcesses.set(instance, devProcess);
  handlers.onDevProcess(devProcess);
  void pipeOutputToLogs(devProcess, "dev", handlers);
}

/** Kills the active dev task for this container, then starts a fresh one. */
export async function restartDev(
  instance: WebContainer,
  handlers: WebContainerTaskHandlers,
): Promise<void> {
  devProcesses.get(instance)?.kill();
  devProcesses.delete(instance);
  handlers.onDevProcess(null);
  await runDev(instance, handlers);
}

/** Installs an npm package and restarts the dev task after success. */
export async function addDependency(
  instance: WebContainer,
  packageName: string,
  handlers: WebContainerTaskHandlers,
): Promise<void> {
  handlers.onLog("install", `$ npm install ${packageName}\n`);
  const installProcess = await getHudhodWorkspace(instance).processes.spawn(
    "npm",
    ["install", packageName],
  );
  void pipeOutputToLogs(installProcess, "install", handlers);
  const exitCode = await installProcess.exit;
  if (exitCode !== 0) {
    throw new Error(`npm install ${packageName} failed with exit code ${exitCode}`);
  }
  await restartDev(instance, handlers);
}
