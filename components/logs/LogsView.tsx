"use client";

import { useEffect, useRef } from "react";
import { useLogsStore, type LogSource } from "@/store/useLogsStore";

const SOURCE_COLOR: Record<LogSource, string> = {
  install: "text-blue-600 dark:text-blue-400",
  dev: "text-emerald-600 dark:text-emerald-400",
  lifecycle: "text-zinc-500 dark:text-zinc-400",
  error: "text-red-600 dark:text-red-400",
};

export function LogsView() {
  const lines = useLogsStore((state) => state.lines);
  const pending = useLogsStore((state) => state.pending);
  const containerRef = useRef<HTMLDivElement>(null);

  const pendingEntries = Object.entries(pending).filter(
    (entry): entry is [LogSource, string] => Boolean(entry[1]),
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, pending]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto bg-white p-2 font-mono text-xs whitespace-pre-wrap dark:bg-zinc-950"
    >
      {lines.map((line) => (
        <div key={line.id} className={SOURCE_COLOR[line.source]}>
          <span className="text-zinc-400 dark:text-zinc-600">
            [{line.source}]
          </span>{" "}
          {line.text}
        </div>
      ))}
      {pendingEntries.map(([source, text]) => (
        <div
          key={`pending-${source}`}
          className={`${SOURCE_COLOR[source]} opacity-60`}
        >
          <span className="text-zinc-400 dark:text-zinc-600">[{source}]</span>{" "}
          {text}
          <span className="animate-pulse">▍</span>
        </div>
      ))}
    </div>
  );
}
