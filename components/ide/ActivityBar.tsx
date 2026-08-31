"use client";

import { openOrFocusPanel, type PanelId } from "@/components/dockview/panelRegistry";
import { SimpleTooltip } from "@/components/ui/SimpleTooltip";
import { useDockviewStore } from "@/store/useDockviewStore";

import { ExplorerIcon, LogsIcon, PreviewIcon, TerminalIcon } from "./icons";

const ACTIVITY_ITEMS: {
  id: PanelId;
  label: string;
  Icon: typeof ExplorerIcon;
}[] = [
  { id: "explorer", label: "Explorer", Icon: ExplorerIcon },
  { id: "logs", label: "Logs", Icon: LogsIcon },
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "preview", label: "Preview", Icon: PreviewIcon },
];

export function ActivityBar() {
  const api = useDockviewStore((state) => state.api);
  const openPanelIds = useDockviewStore((state) => state.openPanelIds);

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#eaeef2] py-2 dark:bg-[#0d1117]">
      {ACTIVITY_ITEMS.map(({ id, label, Icon }) => {
        const isOpen = openPanelIds.has(id);
        return (
          <SimpleTooltip key={id} label={label}>
            <button
              type="button"
              aria-pressed={isOpen}
              onClick={() => api && openOrFocusPanel(api, id)}
              className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                isOpen
                  ? "bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-200/40 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-300"
              }`}
            >
              <Icon />
            </button>
          </SimpleTooltip>
        );
      })}
    </nav>
  );
}
