"use client";

/** First-party extension contributing the terminal panel. */

import { registerReactPanel } from "@hudhod/react";
import { defineExtension } from "@hudhod/sdk";

import { TerminalPanel } from "@/components/dockview/panels/TerminalPanel";
import { TerminalIcon } from "@/components/ide/icons";

export default defineExtension({
  manifest: {
    id: "hudhod.terminal",
    name: "Terminal",
    version: "0.0.0",
    description: "Interactive shell attached to the WebContainer",
    activationEvents: ["onView:terminal"],
    contributes: {
      panels: [
        {
          id: "terminal",
          title: "Terminal",
          location: "bottom",
          icon: TerminalIcon,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "terminal", TerminalPanel, {
        title: "Terminal",
        location: "bottom",
      }),
    );
  },
});
