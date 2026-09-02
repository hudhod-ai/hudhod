"use client";

/** First-party extension contributing the live preview panel. */

import { registerReactPanel } from "@hudhod/react";
import { defineExtension } from "@hudhod/sdk";

import { PreviewPanel } from "@/components/dockview/panels/PreviewPanel";
import { PreviewIcon } from "@/components/ide/icons";

export default defineExtension({
  manifest: {
    id: "hudhod.preview",
    name: "Preview",
    version: "0.0.0",
    description: "Live preview of the running dev server",
    activationEvents: ["onView:preview"],
    contributes: {
      panels: [
        {
          id: "preview",
          title: "Preview",
          location: "right",
          icon: PreviewIcon,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "preview", PreviewPanel, {
        title: "Preview",
        location: "right",
        initialWidth: 420,
      }),
    );
  },
});
