"use client";

/** First-party extension contributing the file explorer panel. */

import { registerReactPanel } from "@hudhod/react";
import { defineExtension } from "@hudhod/sdk";

import { ExplorerPanel } from "@/components/dockview/panels/ExplorerPanel";
import { ExplorerIcon } from "@/components/ide/icons";

export default defineExtension({
  manifest: {
    id: "hudhod.explorer",
    name: "Explorer",
    version: "0.0.0",
    description: "Workspace file tree",
    activationEvents: ["onView:explorer"],
    contributes: {
      panels: [
        {
          id: "explorer",
          title: "Explorer",
          location: "left",
          icon: ExplorerIcon,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "explorer", ExplorerPanel, {
        title: "Explorer",
        location: "left",
        initialWidth: 260,
      }),
    );
  },
});
