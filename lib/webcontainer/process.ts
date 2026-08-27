import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { useLogsStore } from "@/store/useLogsStore";
import { useWebContainerStore } from "@/store/useWebContainerStore";
import { createLineBuffer } from "./logLineBuffer";

async function pipeOutputToLogs(
  process: WebContainerProcess,
  source: "install" | "dev",
): Promise<void> {
  const { append, setPending } = useLogsStore.getState();
  const lineBuffer = createLineBuffer(
    (line) => append(source, line),
    (partial) => setPending(source, partial),
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

/** Runs `npm install`, streaming output to the Logs panel. Throws if it fails. */
export async function runInstall(instance: WebContainer): Promise<void> {
  useWebContainerStore.getState().setStatus("installing");
  const installProcess = await instance.spawn("npm", ["install"]);
  void pipeOutputToLogs(installProcess, "install");
  const exitCode = await installProcess.exit;
  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}`);
  }
}

/** Starts `npm run dev` and stores the process handle so it can be restarted later. */
export async function runDev(instance: WebContainer): Promise<void> {
  useWebContainerStore.getState().setStatus("starting");
  const devProcess = await instance.spawn("npm", ["run", "dev"]);
  useWebContainerStore.getState().setDevProcess(devProcess);
  void pipeOutputToLogs(devProcess, "dev");
}

/** Kills the current dev server process, if any, and starts a fresh one. */
export async function restartDev(instance: WebContainer): Promise<void> {
  const current = useWebContainerStore.getState().devProcess;
  current?.kill();
  await runDev(instance);
}

/** Installs an npm package into the project, then restarts the dev server. */
export async function addDependency(
  instance: WebContainer,
  packageName: string,
): Promise<void> {
  const append = useLogsStore.getState().append;
  append("install", `$ npm install ${packageName}\n`);
  const installProcess = await instance.spawn("npm", ["install", packageName]);
  void pipeOutputToLogs(installProcess, "install");
  const exitCode = await installProcess.exit;
  if (exitCode !== 0) {
    throw new Error(
      `npm install ${packageName} failed with exit code ${exitCode}`,
    );
  }
  await restartDev(instance);
}
