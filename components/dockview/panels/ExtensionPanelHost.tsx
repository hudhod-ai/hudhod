"use client";

import { useEffect, useRef } from "react";
import type { IDockviewPanelProps } from "dockview-react";

import { useExtensionPanelStore } from "@/store/useExtensionPanelStore";

/** Mounts an extension's renderer into a real Dockview panel, keyed by `props.api.id`. */
export function ExtensionPanelHost(props: IDockviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const entry = useExtensionPanelStore.getState().getRenderer(props.api.id);
    const container = containerRef.current;
    if (!entry || !container) return;

    let cancelled = false;
    let cleanup: void | (() => void);

    void (async () => {
      const result = await entry.render(container);
      if (cancelled) {
        result?.();
        return;
      }
      cleanup = result;
    })();

    return () => {
      cancelled = true;
      // Deferred: registerReactPanel's cleanup unmounts React via queueMicrotask,
      // so the container must not be cleared/detached synchronously here.
      cleanup?.();
    };
  }, [props.api.id]);

  return <div ref={containerRef} className="h-full w-full" />;
}
