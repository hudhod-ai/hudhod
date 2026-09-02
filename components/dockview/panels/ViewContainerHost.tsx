"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { IDockviewPanelProps } from "dockview-react";

import { useExtensionPanelStore } from "@/store/useExtensionPanelStore";
import { useExtensionViewStore } from "@/store/useExtensionViewStore";
import { useHudhodWorkspaceStore } from "@/store/useHudhodWorkspaceStore";
import { ExtensionRendererMount } from "./ExtensionRendererMount";

export function ViewContainerHost(props: IDockviewPanelProps) {
  const containerId = props.api.id;
  const panel = useExtensionPanelStore((state) =>
    state.renderers.get(containerId),
  );
  const allViews = useHudhodWorkspaceStore((state) => state.views);
  const renderers = useExtensionViewStore((state) => state.renderers);
  const collapsed = useExtensionViewStore((state) => state.collapsed);
  const setCollapsed = useExtensionViewStore((state) => state.setCollapsed);
  const views = allViews.filter((view) => view.container === containerId);
  const sections = [
    ...(panel
      ? [{ id: containerId, title: panel.options.title, render: panel.render }]
      : []),
    ...views.flatMap((view) => {
      const entry = renderers.get(view.id);
      return entry
        ? [{ id: view.id, title: view.title, render: entry.render }]
        : [];
    }),
  ];

  if (sections.length === 0) return <div className="h-full w-full" />;
  if (sections.length === 1)
    return <ExtensionRendererMount render={sections[0]!.render} />;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      {sections.map((section) => {
        const isCollapsed =
          collapsed.get(`${containerId}:${section.id}`) ?? false;
        return (
          <section
            key={section.id}
            className={`flex min-h-0 flex-col border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 ${isCollapsed ? "shrink-0" : "flex-1"}`}
          >
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1 px-2 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed(containerId, section.id, !isCollapsed)
              }
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              <span>{section.title}</span>
            </button>
            {!isCollapsed && (
              <div className="min-h-0 flex-1">
                <ExtensionRendererMount render={section.render} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
