# @hudhod/sdk

The public API surface for building [hudhod](../../README.md) extensions.

hudhod is an in-browser IDE built on WebContainers. This package describes what
an extension can do. It is **types-first**: the only values it ships are
`defineExtension()` and `isHudhodError()`, so importing it adds essentially
nothing to your bundle.

The same API backs the AI agent tool layer, so anything an extension can do, an
agent can do.

## Install

```bash
pnpm add @hudhod/sdk
```

## Quickstart

```ts
import { defineExtension } from "@hudhod/sdk";

export default defineExtension({
  manifest: {
    id: "acme.todo-finder",
    name: "TODO Finder",
    version: "1.0.0",
    activationEvents: ["onCommand:acme.todoFinder.scan"],
    contributes: {
      commands: [{ id: "acme.todoFinder.scan", title: "Scan for TODOs" }],
    },
  },
  async activate({ hudhod, subscriptions }) {
    subscriptions.push(
      hudhod.commands.registerCommand("acme.todoFinder.scan", async () => {
        const { matches } = await hudhod.search.findInFiles("TODO", {
          include: ["**/*.ts", "**/*.tsx"],
        });
        await hudhod.window.showMessage(`Found ${matches.length} TODOs`);
      }),
    );
  },
});
```

## Design rules

Three constraints shape every signature in this package:

1. **Everything is async.** Even operations that could be synchronous today
   return a promise, so the host can later move extensions into a worker or
   sandboxed frame without a breaking change.
2. **Everything is structured-cloneable.** No classes, no functions, and no live
   objects cross the API boundary — with the single deliberate exception of
   `ProcessHandle`, which carries streams and is therefore same-context only.
   Use `ProcessInfo` when you need a serialisable snapshot.
3. **Paths are absolute and POSIX-style**, rooted at the workspace root (`/`).
   Relative paths are rejected rather than resolved against ambient state.

## API

The root object is `HudhodApi`, delivered as `context.hudhod` on activation.

| Namespace   | Purpose                                         |
| ----------- | ----------------------------------------------- |
| `fs`        | Read and write files                            |
| `workspace` | Workspace edits, edit history, revert           |
| `search`    | Find files by glob, search and replace in files |
| `diff`      | Compare text, create and apply unified patches  |
| `process`   | Spawn processes, run one-shot commands          |
| `terminal`  | Create and drive interactive shells             |
| `commands`  | Register and invoke commands                    |
| `window`    | Notifications, prompts, contributed panels      |

### `hudhod.fs`

| Method                                   | Returns                     |
| ---------------------------------------- | --------------------------- |
| `readFile(path)`                         | `Promise<Uint8Array>`       |
| `readTextFile(path)`                     | `Promise<string>`           |
| `writeFile(path, data, options?)`        | `Promise<void>`             |
| `writeTextFile(path, content, options?)` | `Promise<void>`             |
| `createFile(path, options?)`             | `Promise<void>`             |
| `createDirectory(path)`                  | `Promise<void>`             |
| `delete(path, options?)`                 | `Promise<void>`             |
| `rename(from, to, options?)`             | `Promise<void>`             |
| `copy(from, to, options?)`               | `Promise<void>`             |
| `stat(path)`                             | `Promise<FileStat>`         |
| `exists(path)`                           | `Promise<boolean>`          |
| `readDirectory(path)`                    | `Promise<DirectoryEntry[]>` |
| `watch(path, listener, options?)`        | `Disposable`                |
| `onDidChangeFile`                        | `Event<FileChangeEvent[]>`  |

Writes create missing parent directories by default. Change events are debounced
and delivered in batches.

### `hudhod.process`

| Method                            | Returns                  |
| --------------------------------- | ------------------------ |
| `spawn(command, args?, options?)` | `Promise<ProcessHandle>` |
| `exec(command, args?, options?)`  | `Promise<ExecResult>`    |
| `list()`                          | `Promise<ProcessInfo[]>` |
| `kill(id)`                        | `Promise<boolean>`       |
| `onDidStartProcess`               | `Event<ProcessInfo>`     |
| `onDidExitProcess`                | `Event<ProcessInfo>`     |

`exec()` is guarded so a runaway command cannot hang the browser tab:

| Option           | Default   | Disable with |
| ---------------- | --------- | ------------ |
| `timeout`        | 60 000 ms | `false`      |
| `maxOutputBytes` | 1 MiB     | `false`      |

Breaching either guard kills the process and throws, and the thrown error
carries the output collected so far on `partialOutput`.

> **stdout and stderr are merged.** The WebContainer runtime exposes a single
> output stream per process, so `ExecResult` has one `output` field rather than
> an `stderr` that would always be empty.

### `hudhod.workspace`

Agent edits go through `applyEdit()`, which supports two modes:

```ts
// Apply now; revertable via the edit history, and undoable in the editor.
await hudhod.workspace.applyEdit(edits, { mode: "immediate", label: "Fix types" });

// Show the user a diff and wait. Nothing is written unless they accept.
const { applied } = await hudhod.workspace.applyEdit(edits, { mode: "review" });
```

Edits within a file are applied bottom-up so earlier ranges stay valid, and the
whole set is atomic — if one file fails, none are written.

### `hudhod.commands`

```ts
const sub = hudhod.commands.registerCommand("demo.run", handler, {
  title: "Run Demo",
  category: "Demo",
});
```

Commands without a `title` are callable but stay hidden from the palette.

### `hudhod.window`

```ts
hudhod.window.registerPanel(
  "demo.stats",
  (container) => {
    container.textContent = "Hello";
    return () => {
      /* cleanup on close */
    };
  },
  { title: "Stats", location: "right" },
);
```

## Error handling

Match on `code`, never on message text:

```ts
import { isHudhodError } from "@hudhod/sdk";

try {
  await hudhod.fs.readTextFile("/missing.ts");
} catch (error) {
  if (isHudhodError(error) && error.code === "FileNotFound") {
    // handle it
  }
}
```

Codes: `FileNotFound`, `FileExists`, `NotADirectory`, `NotAFile`,
`DirectoryNotEmpty`, `InvalidPath`, `CommandNotFound`, `CommandExists`,
`ProcessTimeout`, `OutputLimitExceeded`, `PatchFailed`, `Cancelled`.

## Activation events

Prefer lazy activation; every `onStartup` extension delays workbench boot.

| Event               | Fires when                    |
| ------------------- | ----------------------------- |
| `onStartup`         | The workbench is ready        |
| `onCommand:<id>`    | A command is first invoked    |
| `onFileOpen:<glob>` | A matching file is opened     |
| `onView:<panelId>`  | A contributed panel is opened |

## License

MIT
