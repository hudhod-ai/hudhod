/**
 * Example extension: a sidebar view contributed into the Explorer container.
 *
 * Self-contained on purpose — it owns its icon and its component, and depends only on
 * `@hudhod/sdk` and `@hudhod/react`, so it is exactly what a third-party extension looks like.
 *
 * @packageDocumentation
 */

import { registerReactView, useHudhod } from "@hudhod/react";
import { defineExtension, type ActiveEditor } from "@hudhod/sdk";
import { useEffect, useState } from "react";

function OutlinePanel() {
  const hudhod = useHudhod();
  const [active, setActive] = useState<ActiveEditor | undefined>(
    () => hudhod.window.activeEditor,
  );

  useEffect(() => {
    const subscription = hudhod.window.onDidChangeActiveEditor(setActive);
    return () => subscription.dispose();
  }, [hudhod]);

  return (
    <div className="h-full overflow-auto p-3 text-[13px] text-zinc-700 dark:text-zinc-300">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Active editor
      </p>
      {active ? (
        <p className="font-mono text-[12px] break-all">
          {active.path}
          {active.dirty ? " •" : ""}
        </p>
      ) : (
        <p className="text-zinc-500">No file open.</p>
      )}
    </div>
  );
}

export default defineExtension({
  manifest: {
    id: "hudhod.outline",
    name: "Outline",
    version: "0.0.0",
    description: "Example sidebar view contributed into Explorer",
    activationEvents: ["onView:outline"],
    contributes: {
      views: [
        {
          id: "outline",
          title: "Outline",
          container: "explorer",
          order: 100,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactView(context.hudhod, "outline", OutlinePanel, {
        title: "Outline",
      }),
    );
  },
});
