"use client";

import "@hudhod/react/styles.css";

import { FakeProcessSpawner, InMemoryFileSystemProvider } from "@hudhod/core";
import {
  createHudhodReactHost,
  HudhodWorkbench,
  registerReactPanel,
  registerReactView,
  useHudhod,
} from "@hudhod/react";
import type { HudhodReactHost } from "@hudhod/react";
import { defineExtension, type ActiveEditor } from "@hudhod/sdk";
import type { IDockviewPanelProps } from "dockview-react";
import { FileCode2, FolderOpen, PanelLeft } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const filesExtension = defineExtension({
  manifest: {
    id: "demo.files",
    name: "Files",
    version: "1.0.0",
    activationEvents: ["onView:files"],
    contributes: {
      panels: [
        { id: "files", title: "Files", location: "left", icon: FolderOpen },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "files", FilesPanel, {
        title: "Files",
        location: "left",
      }),
    );
  },
});

const activeFileExtension = defineExtension({
  manifest: {
    id: "demo.active-file",
    name: "Active File",
    version: "1.0.0",
    activationEvents: ["onView:active-file"],
    contributes: {
      views: [
        {
          id: "active-file",
          title: "Active File",
          container: "files",
          order: 100,
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactView(context.hudhod, "active-file", ActiveFileView, {
        title: "Active File",
      }),
    );
  },
});

const bookmarksExtension = defineExtension({
  manifest: {
    id: "demo.bookmarks",
    name: "Bookmarks",
    version: "1.0.0",
    activationEvents: ["onView:bookmarks"],
    contributes: {
      panels: [
        {
          id: "bookmarks",
          title: "Bookmarks",
          location: "left",
        },
      ],
    },
  },
  activate(context) {
    context.subscriptions.push(
      registerReactPanel(context.hudhod, "bookmarks", BookmarksPanel, {
        title: "Bookmarks",
        location: "left",
      }),
    );
  },
});

function FilesPanel() {
  return (
    <div className="p-3 text-sm text-zinc-700 dark:text-zinc-200">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <FolderOpen className="size-4" /> demo
      </div>
      <div className="ml-4 flex items-center gap-2 font-mono text-xs text-zinc-500">
        <FileCode2 className="size-3.5" /> hello.ts
      </div>
      <div className="ml-4 mt-1 flex items-center gap-2 font-mono text-xs text-zinc-500">
        <FileCode2 className="size-3.5" /> app.tsx
      </div>
    </div>
  );
}

function BookmarksPanel() {
  return (
    <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">
      No bookmarks yet.
    </div>
  );
}

function ActiveFileView() {
  const hudhod = useHudhod();
  const [active, setActive] = useState<ActiveEditor | undefined>(
    hudhod.window.activeEditor,
  );
  useEffect(() => {
    const subscription = hudhod.window.onDidChangeActiveEditor(setActive);
    return () => subscription.dispose();
  }, [hudhod]);
  return (
    <div className="p-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
      {active?.path ?? "No file selected"}
    </div>
  );
}

const DemoActiveEditorContext = createContext<ActiveEditorSource | undefined>(
  undefined,
);

function EditorPanel(_props: IDockviewPanelProps) {
  const source = useContext(DemoActiveEditorContext);
  const [active, setActive] = useState<ActiveEditor | undefined>(source?.value);

  useEffect(() => {
    if (!source) return;
    const subscription = source.subscribe(setActive);
    return () => subscription.dispose();
  }, [source]);

  const content =
    active?.path === "/src/app.tsx"
      ? "export default function App() {}"
      : 'export const greeting = "Hello from Hudhod";';

  return (
    <div className="h-full bg-white p-6 font-mono text-sm leading-7 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="mb-4 text-xs text-zinc-500">{active?.path}</div>
      <pre className="whitespace-pre-wrap">{content}</pre>
    </div>
  );
}

class ActiveEditorSource {
  #value: ActiveEditor = { path: "/src/hello.ts", dirty: false };
  readonly #listeners = new Set<(editor: ActiveEditor | undefined) => void>();

  get value(): ActiveEditor {
    return this.#value;
  }

  select(path: string): void {
    this.#value = { path, dirty: false };
    for (const listener of this.#listeners) listener(this.#value);
  }

  subscribe(listener: (editor: ActiveEditor | undefined) => void) {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }
}

class HostLifetime {
  #generation = 0;

  mount(): number {
    return ++this.#generation;
  }

  disposeWhenCurrent(generation: number, host: HudhodReactHost): void {
    queueMicrotask(() => {
      if (this.#generation === generation) host.dispose();
    });
  }
}

function createDemoHost(activeEditor: ActiveEditorSource): HudhodReactHost {
  const host = createHudhodReactHost({
    fileSystemProvider: InMemoryFileSystemProvider.from({
      "/src/hello.ts": "export const greeting = 'Hello from Hudhod';",
      "/src/app.tsx": "export default function App() {}",
    }),
    processSpawner: new FakeProcessSpawner(),
    ui: {
      showMessage: async () => {},
      showInputBox: async () => undefined,
      showQuickPick: async () => undefined,
      openFile: async () => {},
      get activeEditor() {
        return activeEditor.value;
      },
      onDidChangeActiveEditor(listener) {
        return activeEditor.subscribe(listener);
      },
    },
  });
  host.registerExtensions([
    filesExtension,
    bookmarksExtension,
    activeFileExtension,
  ]);
  return host;
}

export default function MinimalIdeDemo() {
  const [activeEditor] = useState(() => new ActiveEditorSource());
  const [host] = useState(() => createDemoHost(activeEditor));
  const [hostLifetime] = useState(() => new HostLifetime());
  const [selectedPath, setSelectedPath] = useState(activeEditor.value.path);

  useEffect(() => {
    const generation = hostLifetime.mount();
    return () => hostLifetime.disposeWhenCurrent(generation, host);
  }, [host, hostLifetime]);

  function selectFile(path: string) {
    activeEditor.select(path);
    setSelectedPath(path);
  }

  return (
    <main className="flex  h-screen flex-col bg-zinc-100 dark:bg-zinc-900">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PanelLeft className="size-4 text-emerald-600" /> Minimal Hudhod IDE
        </div>
        <div className="flex gap-1">
          {["/src/hello.ts", "/src/app.tsx"].map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => selectFile(path)}
              className={`rounded px-2 py-1 font-mono text-xs ${selectedPath === path ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            >
              {path.split("/").at(-1)}
            </button>
          ))}
        </div>
      </header>
      <DemoActiveEditorContext.Provider value={activeEditor}>
        <HudhodWorkbench
          host={host}
          editor={EditorPanel}
          initialPanels={["editor", "files", "bookmarks"]}
          getPanelPosition={(panel, api) =>
            panel.id === "bookmarks" && api.getPanel("files")
              ? { referencePanel: "files", direction: "below" }
              : undefined
          }
          className="h-full w-full"
          showPanelHeaders={false}
          activityBar={{
            position: "left",
            className: "bg-[#f6f8fa]",
            renderItem: ({ panel, isOpen, open }) => (
              <button
                type="button"
                title={panel.title}
                aria-pressed={isOpen}
                onClick={() => {
                  toast.info(`${panel.title} selected`);
                  open();
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-md ${isOpen ? "bg-zinc-200 text-zinc-900" : "text-zinc-600 hover:bg-zinc-200/60"}`}
              >
                <FolderOpen className="size-5" />
              </button>
            ),
          }}
        />
      </DemoActiveEditorContext.Provider>
    </main>
  );
}
