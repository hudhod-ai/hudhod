import "dockview-react/dist/styles/dockview.css";

import { ChevronDown, ChevronRight, Puzzle } from "lucide-react";
import {
  DockviewReact,
  themeGithubDarkSpaced,
  themeGithubLightSpaced,
  type DockviewApi,
  type AddPanelOptions,
  type IDockviewReactProps,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import { useEffect, useState } from "react";
import type { ComponentType, ElementType, ReactElement, SVGProps } from "react";

import type { HudhodReactHost, HudhodReactRenderer } from "./host";

const EXTENSION_PANEL_HOST = "hudhod-extension-panel";
const DEFAULT_INITIAL_PANELS = ["editor"];

/** Public metadata for a panel rendered by {@link HudhodActivityBar}. */
export interface HudhodActivityBarPanel {
  readonly id: string;
  readonly title: string;
  readonly icon?: unknown;
  readonly location: "left" | "right" | "bottom" | "center";
  readonly source: "extension" | "builtin";
  readonly extensionId?: string;
}

export interface HudhodActivityBarItemProps {
  readonly panel: HudhodActivityBarPanel;
  readonly isOpen: boolean;
  open(): void;
}

export interface HudhodActivityBarOptions {
  readonly position?: "left" | "right" | "top" | "bottom" | "hidden";
  readonly className?: string;
  readonly itemClassName?: string;
  readonly activeItemClassName?: string;
  renderItem?: (props: HudhodActivityBarItemProps) => ReactElement;
}

export interface HudhodWorkbenchProps {
  readonly host: HudhodReactHost;
  readonly editor: ComponentType<IDockviewPanelProps>;
  /** Additional native Dockview components. Hudhod reserves `hudhod-extension-panel`. */
  readonly nativeComponents?: Readonly<
    Record<string, ComponentType<IDockviewPanelProps>>
  >;
  readonly colorMode?: "light" | "dark";
  /** Activity bar placement and rendering overrides. */
  readonly activityBar?: HudhodActivityBarOptions;
  /** Whether Dockview's native panel tab/header strip is visible. */
  readonly showPanelHeaders?: boolean;
  readonly initialPanels?: readonly string[];
  /** Overrides a contributed panel's default Dockview position when it opens. */
  readonly getPanelPosition?: (
    panel: HudhodActivityBarPanel,
    api: DockviewApi,
  ) => AddPanelOptions["position"] | undefined;
  readonly className?: string;
  /** Called after Hudhod attaches its panel controller to a ready Dockview instance. */
  readonly onReady?: (api: DockviewApi) => void;
  /** Called when a panel is added or removed. */
  readonly onPanelChange?: (panelIds: readonly string[]) => void;
  /**
   * Additional Dockview options forwarded unchanged.
   * `components` and `onReady` are reserved so extension panel hosting remains intact.
   */
  readonly dockviewProps?: Omit<IDockviewReactProps, "components" | "onReady">;
}

/** A package-only Dockview workbench for a composed Hudhod React host. */
export function HudhodWorkbench({
  host,
  editor: Editor,
  nativeComponents,
  colorMode = "light",
  showPanelHeaders = true,
  initialPanels = DEFAULT_INITIAL_PANELS,
  className = "h-full w-full",
  onReady,
  onPanelChange,
  dockviewProps,
  activityBar,
  getPanelPosition,
}: HudhodWorkbenchProps) {
  const [, rerender] = useState(0);
  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const activityBarPosition = activityBar?.position ?? "left";
  const components: Record<
    string,
    (props: IDockviewPanelProps) => ReactElement
  > = {
    ...nativeComponents,
    editor: (props) => <Editor {...props} />,
    [EXTENSION_PANEL_HOST]: (props) => <ContainerHost host={host} {...props} />,
  };

  useEffect(() => {
    const subscription = host.onDidChangeRenderers(() =>
      rerender((value) => value + 1),
    );
    return () => subscription.dispose();
  }, [host]);

  useEffect(() => {
    if (!dockviewApi || !onPanelChange) return;
    const notify = () =>
      onPanelChange(dockviewApi.panels.map((panel) => panel.id));
    const addSubscription = dockviewApi.onDidAddPanel(notify);
    const removeSubscription = dockviewApi.onDidRemovePanel(notify);
    notify();
    return () => {
      addSubscription.dispose();
      removeSubscription.dispose();
    };
  }, [dockviewApi, onPanelChange]);

  useEffect(() => () => host.setPanelController(undefined), [host]);

  const activityBarElement =
    activityBarPosition === "hidden" ? null : (
      <HudhodActivityBar
        host={host}
        dockviewApi={dockviewApi}
        {...activityBar}
      />
    );
  const isHorizontal =
    activityBarPosition === "top" || activityBarPosition === "bottom";
  const dockview = (
    <DockviewReact
      {...dockviewProps}
      className={`${className} ${showPanelHeaders ? "" : "hudhod-workbench--hide-panel-headers"}`}
      components={components}
      defaultTabComponent={
        dockviewProps?.defaultTabComponent ?? HudhodDefaultTab
      }
      theme={
        colorMode === "dark" ? themeGithubDarkSpaced : themeGithubLightSpaced
      }
      onReady={({ api }) => {
        api.addPanel({
          id: "editor",
          title: "Editor",
          component: "editor",
        });
        host.setPanelController(createController(host, api, getPanelPosition));
        setDockviewApi(api);
        queueMicrotask(() => {
          void (async () => {
            for (const id of initialPanels) {
              if (id !== "editor") await host.api.window.openPanel(id);
            }
          })();
        });
        onReady?.(api);
      }}
    />
  );

  return (
    <div className={`flex h-full min-h-0 ${isHorizontal ? "flex-col" : ""}`}>
      {(activityBarPosition === "left" || activityBarPosition === "top") &&
        activityBarElement}
      {dockview}
      {(activityBarPosition === "right" || activityBarPosition === "bottom") &&
        activityBarElement}
      {!showPanelHeaders && (
        <style>{`.hudhod-workbench--hide-panel-headers .dv-tabs-and-actions-container { display: none; }`}</style>
      )}
    </div>
  );
}

/** A standalone activity bar that may be placed anywhere in a host shell. */
export function HudhodActivityBar({
  host,
  dockviewApi,
  position = "left",
  className = "",
  itemClassName = "",
  activeItemClassName = "",
  renderItem,
}: HudhodActivityBarOptions & {
  readonly host: HudhodReactHost;
  readonly dockviewApi?: DockviewApi | null;
}) {
  const panels = usePanels(host);
  const openPanelIds = useOpenPanelIds(dockviewApi);
  const horizontal = position === "top" || position === "bottom";
  if (position === "hidden") return null;

  return (
    <nav
      className={`flex shrink-0 items-center gap-1 p-2 ${horizontal ? "h-12 flex-row" : "w-12 flex-col"} ${className}`}
      aria-label="Activity bar"
    >
      {panels.map((panel) => {
        const isOpen = openPanelIds.has(panel.id);
        const open = () => void host.api.window.openPanel(panel.id);
        if (renderItem)
          return (
            <span key={panel.id}>{renderItem({ panel, isOpen, open })}</span>
          );
        const Icon = isIcon(panel.icon) ? panel.icon : Puzzle;
        return (
          <button
            key={panel.id}
            type="button"
            title={panel.title}
            aria-pressed={isOpen}
            onClick={open}
            className={`flex h-10 w-10 items-center justify-center rounded-md ${itemClassName} ${isOpen ? activeItemClassName : ""}`}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </nav>
  );
}

function HudhodDefaultTab({ api }: IDockviewPanelHeaderProps) {
  return (
    <div className="flex h-full min-w-0 items-center px-3 text-[12px] text-zinc-700 dark:text-zinc-300">
      <span className="truncate">{api.title}</span>
    </div>
  );
}

function usePanels(host: HudhodReactHost) {
  const [panels, setPanels] = useState(() => host.panels.getPanels());
  useEffect(() => {
    setPanels(host.panels.getPanels());
    const subscription = host.panels.onDidChangePanels(setPanels);
    return () => subscription.dispose();
  }, [host]);
  return panels;
}

function useOpenPanelIds(dockviewApi: DockviewApi | null | undefined) {
  const [panelIds, setPanelIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  useEffect(() => {
    if (!dockviewApi) return;
    const sync = () =>
      setPanelIds(new Set(dockviewApi.panels.map((panel) => panel.id)));
    const addSubscription = dockviewApi.onDidAddPanel(sync);
    const removeSubscription = dockviewApi.onDidRemovePanel(sync);
    sync();
    return () => {
      addSubscription.dispose();
      removeSubscription.dispose();
    };
  }, [dockviewApi]);
  return panelIds;
}

function createController(
  host: HudhodReactHost,
  api: DockviewApi,
  getPanelPosition?: HudhodWorkbenchProps["getPanelPosition"],
) {
  return {
    async openPanel(id: string) {
      await host.extensions.activateByEvent(`onView:${id}`);
      for (const view of host.views.getViewsForContainer(id)) {
        await host.extensions.activateByEvent(`onView:${view.id}`);
      }
      const panel = host.panels
        .getPanels()
        .find((candidate) => candidate.id === id);
      if (!panel || api.getPanel(id)) {
        api.getPanel(id)?.focus();
        return;
      }
      const position =
        getPanelPosition?.(panel, api) ?? defaultPanelPosition(panel, api);
      api.addPanel({
        id,
        title: panel.title,
        component: EXTENSION_PANEL_HOST,
        position,
      });
    },
    async closePanel(id: string) {
      const panel = api.getPanel(id);
      if (!panel) return false;
      panel.api.close();
      return true;
    },
  };
}

function defaultPanelPosition(
  panel: HudhodActivityBarPanel,
  api: DockviewApi,
): AddPanelOptions["position"] | undefined {
  const referencePanel = api.getPanel("editor") ? "editor" : api.panels[0]?.id;
  if (!referencePanel) return undefined;
  const direction =
    panel.location === "left"
      ? "left"
      : panel.location === "right"
        ? "right"
        : panel.location === "bottom"
          ? "below"
          : "within";
  return { referencePanel, direction };
}

function ContainerHost({
  host,
  api,
}: IDockviewPanelProps & { host: HudhodReactHost }) {
  const [, rerender] = useState(0);
  const views = useViews(host, api.id);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const subscription = host.onDidChangeRenderers(() =>
      rerender((value) => value + 1),
    );
    return () => subscription.dispose();
  }, [host]);
  const sections = [
    ...(host.panelRenderers.get(api.id)
      ? [
          {
            id: api.id,
            title: api.title,
            entry: host.panelRenderers.get(api.id)!,
          },
        ]
      : []),
    ...views.flatMap((view) =>
      host.viewRenderers.get(view.id)
        ? [
            {
              id: view.id,
              title: view.title,
              entry: host.viewRenderers.get(view.id)!,
            },
          ]
        : [],
    ),
  ];
  if (sections.length === 0) return <div className="h-full w-full" />;
  if (sections.length === 1)
    return <RendererMount entry={sections[0]!.entry} />;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      {sections.map((section) => {
        const isCollapsed = collapsed.has(section.id);
        return (
          <section
            key={section.id}
            className={
              isCollapsed ? "shrink-0" : "flex min-h-0 flex-1 flex-col"
            }
          >
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1 px-2 text-left text-[11px] font-medium uppercase"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  isCollapsed ? next.delete(section.id) : next.add(section.id);
                  return next;
                })
              }
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
              {section.title}
            </button>
            {!isCollapsed && (
              <div className="min-h-0 flex-1">
                <RendererMount entry={section.entry} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function useViews(host: HudhodReactHost, containerId: string) {
  const [views, setViews] = useState(() =>
    host.views.getViewsForContainer(containerId),
  );
  useEffect(() => {
    setViews(host.views.getViewsForContainer(containerId));
    const subscription = host.views.onDidChangeViews(() =>
      setViews(host.views.getViewsForContainer(containerId)),
    );
    return () => subscription.dispose();
  }, [containerId, host]);
  return views;
}

function RendererMount({ entry }: { entry: HudhodReactRenderer }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!element) return;
    const mount = document.createElement("div");
    mount.className = "h-full w-full";
    element.append(mount);
    let cancelled = false;
    let cleanup: void | (() => void);
    void Promise.resolve(entry.render(mount)).then((result) => {
      if (cancelled) result?.();
      else cleanup = result;
    });
    return () => {
      cancelled = true;
      cleanup?.();
      queueMicrotask(() => mount.remove());
    };
  }, [element, entry]);
  return <div ref={setElement} className="h-full w-full" />;
}

function isIcon(icon: unknown): icon is ElementType<SVGProps<SVGSVGElement>> {
  return (
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && "$$typeof" in icon)
  );
}
