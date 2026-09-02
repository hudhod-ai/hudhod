"use client";

import { useEffect, useRef } from "react";

import type { PanelRenderer } from "@hudhod/sdk";

export function ExtensionRendererMount({
  render,
}: {
  readonly render: PanelRenderer;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const mount = document.createElement("div");
    mount.className = "h-full w-full";
    host.append(mount);

    let cancelled = false;
    let cleanup: void | (() => void);
    void (async () => {
      const result = await render(mount);
      if (cancelled) {
        result?.();
        return;
      }
      cleanup = result;
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      queueMicrotask(() => mount.remove());
    };
  }, [render]);

  return <div ref={containerRef} className="h-full w-full" />;
}
