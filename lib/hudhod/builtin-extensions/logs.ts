"use client";

/** First-party extension contributing the logs panel. */

import { registerReactPanel } from "@hudhod/react";
import { defineExtension } from "@hudhod/sdk";

import { LogsPanel } from "@/components/dockview/panels/LogsPanel";
import { LogsIcon } from "@/components/ide/icons";

export default defineExtension({
  manifest: {
    id: "hudhod.logs",
    name: "Logs",
    version: "0.0.0",
    description: "Lifecycle, install, and dev server output",
    activationEvents: ["onView:logs"],
    contributes: {
      panels: [
        {
          id: "logs",
          title: "Logs",
          location: "bottom",
          icon: LogsIcon,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "logs", LogsPanel, {
        title: "Logs",
        location: "bottom",
        initialHeight: 220,
      }),
    );
  },
});
