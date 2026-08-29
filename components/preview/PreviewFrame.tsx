"use client";

import { useEffect, useRef, useState } from "react";
import { useWebContainerStore } from "@/store/useWebContainerStore";
import { useThemeStore } from "@/store/useThemeStore";

function ReloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9Z" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3H3v6M15 3h6v6M15 21h6v-6M9 21H3v-6" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9h6V3M21 9h-6V3M21 15h-6v6M3 15h6v6" />
    </svg>
  );
}

export function PreviewFrame() {
  const mode = useThemeStore((state) => state.mode);
  const previewUrl = useWebContainerStore((state) => state.previewUrl);

  const inspectorUrl = previewUrl
    ? `${previewUrl}/mcp/inspector?theme=${mode}`
    : null;

  console.log("previewUrl:", previewUrl, "inspectorUrl:", inspectorUrl);

  // Remount on previewUrl change so address/path state resets without an effect.
  return <BrowserFrame key={previewUrl ?? "none"} previewUrl={inspectorUrl} />;
}

function BrowserFrame({ previewUrl }: { previewUrl: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState("/");
  const [addressInput, setAddressInput] = useState("/");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === previewAreaRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function navigate(nextPath: string) {
    const normalized = nextPath.trim().startsWith("/")
      ? nextPath.trim()
      : `/${nextPath.trim()}`;
    setPath(normalized);
    setAddressInput(normalized);
  }

  async function handleReload() {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const { reloadPreview } = await import("@webcontainer/api");
    await reloadPreview(iframe);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await previewAreaRef.current?.requestFullscreen();
    }
  }

  const fullUrl = previewUrl ? `${previewUrl}${path}` : null;

  console.log("fullUrl:", fullUrl);

  return (
    <div className="flex h-full flex-col bg-zinc-200 dark:bg-zinc-900">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-300 px-2 py-1.5 dark:border-zinc-700">
        <span className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <button
          type="button"
          title="Home"
          onClick={() => navigate("/")}
          disabled={!previewUrl}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-300/60 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700/60"
        >
          <HomeIcon />
        </button>
        <button
          type="button"
          title="Reload"
          onClick={handleReload}
          disabled={!previewUrl}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-300/60 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700/60"
        >
          <ReloadIcon />
        </button>
        <form
          className="min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(addressInput);
          }}
        >
          <input
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            disabled={!previewUrl}
            spellCheck={false}
            placeholder="/"
            className="w-full truncate rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] text-zinc-600 outline-none focus:border-blue-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          />
        </form>
        <button
          type="button"
          title={isFullscreen ? "Exit full screen" : "View full screen"}
          onClick={toggleFullscreen}
          disabled={!previewUrl}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-zinc-300/60 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700/60"
        >
          {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>

      <div ref={previewAreaRef} className="min-h-0 flex-1 bg-white">
        {!fullUrl ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Waiting for the dev server to become ready…
          </div>
        ) : (
          <iframe
            key={previewUrl}
            ref={iframeRef}
            src={fullUrl}
            title="App preview"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}
