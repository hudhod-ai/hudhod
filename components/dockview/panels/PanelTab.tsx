"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, X } from "lucide-react";
import type { IDockviewPanelHeaderProps } from "dockview-react";

// Hidden until this tab is hovered/active; each button opts back into full opacity on
// its own :hover (opacity set on an ancestor can't be "undone" by a child's opacity).
const actionButtonClass =
  "flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-500 opacity-0 outline-none transition-opacity hover:bg-zinc-300/60 hover:!opacity-100 dark:text-zinc-400 dark:hover:bg-zinc-700 [.dv-active-tab_&]:opacity-70 [.dv-tab:hover_&]:opacity-70";

/**
 * Custom dockview tab: title on the left, a "..." actions menu and a close X on the
 * right - matching VS Code's flat view/tab header instead of a floating chip.
 */
export function PanelTab({ api }: IDockviewPanelHeaderProps) {
  return (
    <div className="flex h-full w-full min-w-0 items-center gap-1 px-2.5 text-[12px] text-zinc-700 dark:text-zinc-300">
      <span className="min-w-0 flex-1 truncate">{api.title}</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Panel actions"
            onPointerDown={(event) => event.preventDefault()}
            className={actionButtonClass}
          >
            <MoreHorizontal size={13} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-28 rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-800"
          >
            <DropdownMenu.Item
              onSelect={() => api.close()}
              className="cursor-pointer rounded px-2 py-1 text-xs text-zinc-700 outline-none hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Close
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <button
        type="button"
        aria-label="Close panel"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => api.close()}
        className={actionButtonClass}
      >
        <X size={13} />
      </button>
    </div>
  );
}
