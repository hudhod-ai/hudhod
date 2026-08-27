"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

/** Thin wrapper around Radix Tooltip with the app's default styling. */
export function Tooltip({ label, children, side = "right" }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={300}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-md bg-zinc-800 px-2 py-1 text-[11px] text-white shadow-md dark:bg-zinc-700"
        >
          {label}
          <RadixTooltip.Arrow className="fill-zinc-800 dark:fill-zinc-700" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;
