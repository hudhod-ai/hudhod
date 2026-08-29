"use client";

import "@xterm/xterm/css/xterm.css";
import type { WebContainerProcess } from "@webcontainer/api";
import { useEffect, useRef } from "react";

import { getWebContainer } from "@/lib/webcontainer/boot";

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let shellProcess: WebContainerProcess | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let terminalInstance: import("@xterm/xterm").Terminal | undefined;

    async function setup() {
      const [{ Terminal: XTerm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      const fitAddon = new FitAddon();
      const xterm = new XTerm({
        convertEol: true,
        fontSize: 13,
        theme: { background: "#ffffff", foreground: "#1f2328" },
      });
      xterm.loadAddon(fitAddon);
      xterm.open(containerRef.current);
      fitAddon.fit();
      terminalInstance = xterm;

      const instance = await getWebContainer();
      if (disposed) {
        xterm.dispose();
        return;
      }

      shellProcess = await instance.spawn("jsh", {
        terminal: { cols: xterm.cols, rows: xterm.rows },
      });

      void shellProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            xterm.write(data);
          },
        }),
      );

      const input = shellProcess.input.getWriter();
      xterm.onData((data) => {
        void input.write(data);
      });

      resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        shellProcess?.resize({ cols: xterm.cols, rows: xterm.rows });
      });
      resizeObserver.observe(containerRef.current);
    }

    void setup();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      shellProcess?.kill();
      terminalInstance?.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full p-1" />;
}
