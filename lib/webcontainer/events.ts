import type { WebContainer } from "@webcontainer/api";

/** The events the workbench needs from its WebContainer runtime. */
export interface WebContainerUiHandlers {
  /** Reports a runtime error. */
  onError(error: { message: string }): void;
  /** Adds a lifecycle line to the host's log surface. */
  onLifecycleLog(message: string): void;
  /** Publishes a server preview URL. */
  onPreview(url: string, port: number): void;
  /** Updates the host's runtime status projection. */
  onStatusChange(status: "running"): void;
}

/** Wires WebContainer lifecycle events into callbacks supplied by the workbench. */
export function attachWebContainerEvents(
  instance: WebContainer,
  handlers: WebContainerUiHandlers,
): () => void {

  const unsubscribeServerReady = instance.on("server-ready", (port, url) => {
    handlers.onLifecycleLog(`Server ready on port ${port}: ${url}\n`);
    handlers.onPreview(url, port);
    handlers.onStatusChange("running");
  });

  const unsubscribeError = instance.on("error", (error) => {
    handlers.onError(error);
  });

  const unsubscribePort = instance.on("port", (port, type, url) => {
    handlers.onLifecycleLog(`Port ${port} ${type}: ${url}\n`);
  });

  return () => {
    unsubscribeServerReady();
    unsubscribeError();
    unsubscribePort();
  };
}
