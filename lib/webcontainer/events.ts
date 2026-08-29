import type { WebContainer } from "@webcontainer/api";

import { useLogsStore } from "@/store/useLogsStore";
import { useWebContainerStore } from "@/store/useWebContainerStore";

/** Wires WebContainer lifecycle events into the logs/status stores. Returns an unsubscribe fn. */
export function attachWebContainerEvents(instance: WebContainer): () => void {
  const append = useLogsStore.getState().append;

  const unsubscribeServerReady = instance.on("server-ready", (port, url) => {
    append("lifecycle", `Server ready on port ${port}: ${url}\n`);
    useWebContainerStore.getState().setPreview(url, port);
    useWebContainerStore.getState().setStatus("running");
  });

  const unsubscribeError = instance.on("error", (error) => {
    append("error", `${error.message}\n`);
    useWebContainerStore.getState().setError(error.message);
  });

  const unsubscribePort = instance.on("port", (port, type, url) => {
    append("lifecycle", `Port ${port} ${type}: ${url}\n`);
  });

  return () => {
    unsubscribeServerReady();
    unsubscribeError();
    unsubscribePort();
  };
}
