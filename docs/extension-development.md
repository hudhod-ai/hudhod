# Extension Development Guide

Extensions are the primary way to customize and extend the Hudhod IDE. This guide covers extension architecture, naming conventions, the manifest format, activation events, and available APIs.

For composing a host IDE from Hudhod packages, see
[COMPOSABLE-IDE-DEVELOPMENT.md](./COMPOSABLE-IDE-DEVELOPMENT.md). This guide is for extension
authors.

## Table of Contents

- [Naming Conventions](#naming-conventions)
- [Extension Architecture](#extension-architecture)
- [Project Structure](#project-structure)
- [Manifest Format](#manifest-format)
- [Extension Lifecycle](#extension-lifecycle)
- [Available APIs](#available-apis)
- [Example: New File Extension](#example-new-file-extension)
- [Best Practices](#best-practices)

---

## Naming Conventions

### Extension IDs

Extension IDs are namespaced identifiers used internally by the IDE. They must be unique across all loaded extensions.

**Format**: `{namespace}.{feature-name}`

**Examples**:

- `hudhod.new-file` — built-in file creation
- `hudhod.workbench.showExplorer` — built-in explorer command
- `user.custom-linter` — hypothetical custom extension

**Rules**:

- Use lowercase letters, numbers, and dots only
- Namespace should reflect the publisher or domain
- Feature name should be descriptive but concise
- Avoid generic names like "util" or "helper"

### Package Names

Packages are published as npm packages under the `@hudhod` scope.

**Format**: `@hudhod/extension-{feature-name}`

**Examples**:

- `@hudhod/extension-new-file`
- `@hudhod/extension-prettier`
- `@hudhod/extension-eslint`

**Rules**:

- Use kebab-case (hyphens, not underscores)
- Start with `extension-` prefix for clarity
- Keep the name short and memorable

---

## Extension Architecture

### Layers

The extension system is built on three tiers:

1. **SDK** (`packages/sdk`) — Public type contract
   - Types: manifest, context, APIs
   - Serializable: safe for cross-process communication
   - Version: stable, semver

2. **Core** (`packages/core`) — Runtime implementation
   - KeybindingRegistry, WindowService, extension host
   - Environment-agnostic (testable in Node)
   - Not directly consumed by extensions

3. **React** (`packages/react`) — React bindings and reusable Dockview workbench

- React panel/view helpers and the composed React host
- Product UI enters through the host UI adapter

4. **Environment adapters** (`packages/webcontainer`) — Runtime-specific providers

- WebContainer filesystem and process adapters
- Other environments can provide `FileSystemProvider` and `ProcessSpawner` implementations

### Extension Lifecycle

```
1. load()
   └─ Extension code imported, manifest parsed

2. register()
   └─ Keybindings registered immediately (enables lazy activation)

3. activateByEvent(event)
   └─ Extension matches activation event?
      ├─ YES: activate() called
      └─ NO: extension stays dormant

4. activate(context)
   └─ Extension runs initialization
   └─ Subscribes to events, registers commands

5. deactivate()
   └─ Extension cleaned up (if disposable subscriptions exist)
```

**Key insight**: Keybindings are registered at step 2 (before activation) so the IDE can dispatch them and trigger lazy activation at step 3.

---

## Project Structure

```
packages/extension-new-file/
├── src/
│   └── index.ts               # Extension entry point (exports default)
├── package.json               # Dependencies, metadata
├── tsconfig.json              # TypeScript configuration
├── tsdown.config.ts           # Build configuration
└── dist/
    ├── index.js               # Bundled output
    └── index.d.ts             # TypeScript declarations
```

### File Descriptions

**`src/index.ts`**: Main extension file

- Exports a single default export: the extension definition
- Uses `defineExtension()` helper from `@hudhod/sdk`
- Defines manifest and `activate()` function

**`package.json`**: Standard npm package metadata

- `name`: `@hudhod/extension-{feature}`
- `version`: semver (starting at `0.0.0` for development)
- `description`: Short description of what the extension does
- `dependencies`: Should minimize to `@hudhod/sdk` only

**`tsconfig.json`**: TypeScript settings

- Target: `ES2020+` (modern JavaScript, available in modern browsers)
- Module: `ESM` (ECMAScript modules)
- Strict mode: enabled (`strict: true`)

**`tsdown.config.ts`**: Rolldown bundler configuration

- Entry: `src/index.ts`
- Output: `dist/index.js` and `dist/index.d.ts`
- Handles tree-shaking and minification

---

## Manifest Format

The manifest is a `ExtensionManifest` object that declares what an extension contributes to the IDE.

```typescript
{
  id: "hudhod.new-file",                           // Unique identifier
  name: "New File",                                 // Display name
  version: "0.0.0",                                 // Semantic version
  description: "Create a new file with Ctrl+N",    // Short description

  activationEvents: [                              // When to activate
    "onCommand:hudhod.newFile.create"              // Activated on command
  ],

  contributes: {
    commands: [                                    // Available commands
      {
        id: "hudhod.newFile.create",               // Command ID
        title: "New File",                         // Display title
        category: "File"                           // UI category
      }
    ],
    keybindings: [                                 // Keyboard shortcuts
      {
        command: "hudhod.newFile.create",          // Command to run
        key: "ctrl+n",                             // Windows/Linux
        mac: "cmd+n"                               // macOS override
      }
    ]
  }
}
```

### Key Fields

#### `id`

- **Type**: `string`
- **Required**: Yes
- **Constraints**: Must be unique, lowercase with dots
- **Used for**: Extension identification, lazy activation triggers

#### `activationEvents`

- **Type**: `string[]`
- **Options**:
  - `"onStartup"` — Activate when IDE starts
  - `"onCommand:{id}"` — Activate when command is invoked
  - `"onFileOpen:{glob}"` — Activate when file matching glob is opened
  - `"onView:{id}"` — Activate when panel/view is revealed
- **Performance**: Use specific events to keep memory low (lazy loading)

#### `contributes.commands`

- **Type**: `CommandContribution[]`
- **Fields**:
  - `id`: Unique command identifier
  - `title`: Display name in UI
  - `category`: (optional) Grouping for command palette
- **Used for**: Command palette, keybinding targets

#### `contributes.keybindings`

- **Type**: `KeybindingContribution[]`
- **Fields**:
  - `command`: Command ID to run
  - `key`: Binding for Windows/Linux (e.g., `"ctrl+shift+p"`)
  - `mac`: (optional) Override for macOS (e.g., `"cmd+shift+p"`)
- **Format**: Modifiers + key, comma-separated for chords
  - Modifiers: `ctrl`, `shift`, `alt` (lowercase)
  - macOS: `cmd` is automatically converted to `ctrl` internally
  - Key: single key like `"p"`, `"f5"`, etc.

---

## Extension Lifecycle

### Activation Events

Extensions activate lazily based on **activation events** in their manifest. This keeps the IDE fast at startup.

**Example activation events**:

```typescript
// Activate on startup (heavyweight extensions only)
activationEvents: ["onStartup"];

// Activate when user runs this command
activationEvents: ["onCommand:my.extension.run"];

// Activate when user opens a TypeScript file
activationEvents: ["onFileOpen:*.ts"];

// Activate when the "explorer" panel becomes visible
activationEvents: ["onView:explorer"];

// Multiple events: activate on any of them
activationEvents: ["onStartup", "onCommand:my.command"];
```

### The `activate()` Function

```typescript
export default defineExtension({
  manifest: { ... },

  activate(context: ExtensionContext) {
    const { subscriptions, hudhod } = context;

    // Register commands
    subscriptions.push(
      hudhod.commands.registerCommand("my.command", async () => {
        // Command logic
      })
    );

    // Register keybindings (optional, usually via manifest)
    subscriptions.push(
      hudhod.keybindings.registerKeybinding({
        command: "my.command",
        key: "ctrl+k"
      })
    );

    // Subscribe to events
    subscriptions.push(
      hudhod.fs.onDidChangeFile((event) => {
        // File system change
      })
    );
  }
});
```

**Context Properties**:

- `subscriptions`: Array to collect `Disposable` objects for cleanup
- `hudhod`: The `HudhodApi` instance (all available services)

**Best Practice**: Always push disposables to `subscriptions` for automatic cleanup.

---

## Available APIs

### View Containers And Views

Use `contributes.panels` for a standalone Dockview panel. It remains a convenient
single-view container and continues to provide its own activity-bar icon and body.

Use `contributes.viewContainers` to declare an activity-bar container that can host
multiple views. A `contributes.views` entry supplies a collapsible body section for a
container. Its `container` may point to a container declared by another extension;
for example, an extension can contribute a view to `explorer` without owning it.

```typescript
contributes: {
  views: [{ id: "acme.todo.results", title: "TODO Results", container: "explorer", order: 100 }];
}
```

View sections are ordered by ascending `order`. Views without an `order` follow ordered
views, and equal values retain manifest registration order. The container opening process
activates every extension with an `onView:<viewId>` event for its views, so view extensions
stay lazy until their container is first opened. Register the body with `registerView`, or
use `registerReactView` for React components:

```tsx
context.subscriptions.push(
  registerReactView(context.hudhod, "acme.todo.results", ResultsView, {
    title: "TODO Results",
  }),
);
```

### File System (`hudhod.fs`)

```typescript
// Read
await hudhod.fs.readTextFile(path: string): Promise<string>
await hudhod.fs.readBinaryFile(path: string): Promise<Uint8Array>

// Write
await hudhod.fs.writeTextFile(path: string, content: string): Promise<void>
await hudhod.fs.writeBinaryFile(path: string, data: Uint8Array): Promise<void>
await hudhod.fs.createFile(path: string): Promise<void>

// Directory operations
await hudhod.fs.mkdir(path: string): Promise<void>
await hudhod.fs.rmdir(path: string, options?: { recursive: boolean }): Promise<void>
await hudhod.fs.rm(path: string, options?: { recursive: boolean }): Promise<void>

// Listing and metadata
await hudhod.fs.readdir(path: string): Promise<DirectoryEntry[]>
await hudhod.fs.stat(path: string): Promise<FileStat>

// Watching
const disposable = hudhod.fs.onDidChangeFile((event: FileChangeEvent) => { ... })
```

### Commands (`hudhod.commands`)

```typescript
// Register a command
const disposable = hudhod.commands.registerCommand(
  "my.command",
  async (arg1: string, arg2: number) => {
    // Command implementation
  },
);

// Execute a command
await hudhod.commands.executeCommand("my.command", arg1, arg2);

// Query available commands
const list = await hudhod.commands.getCommands();
```

### Window UI (`hudhod.window`)

```typescript
// Show input box
const result = await hudhod.window.showInputBox({
  title: "Enter name",
  placeholder: "example",
  value: "default",
  validate: (input) => input.trim() ? undefined : "Required"
})

// Show message
await hudhod.window.showMessage("Operation complete", "info")  // "info" | "warning" | "error"

// Quick pick (single selection)
const choice = await hudhod.window.showQuickPick({
  items: [
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" }
  ],
  placeholder: "Choose one"
})

// Get active editor
const editor = hudhod.window.activeEditor  // { path: string, dirty: boolean } | undefined

// React to editor changes
const disposable = hudhod.window.onDidChangeActiveEditor((editor) => { ... })

// Open file
await hudhod.window.openFile(path: string)
```

### Search (`hudhod.search`)

```typescript
// Find files by glob
const files = await hudhod.search.findFiles("**/*.ts", { exclude: "**/node_modules/**" });

// Search file contents
const results = await hudhod.search.findInFiles("TODO", "**/*.ts", { matchWholeWord: true });
```

### Keybindings (`hudhod.keybindings`)

```typescript
// Register a keybinding (usually done via manifest)
const disposable = hudhod.keybindings.registerKeybinding({
  command: "my.command",
  key: "ctrl+alt+x",
  mac: "cmd+alt+x",
});

// Get all active keybindings
const bindings = await hudhod.keybindings.getKeybindings();
```

### Processes (`hudhod.process`)

```typescript
// Spawn a process
const handle = await hudhod.process.spawn("npm", ["install"], {
  cwd: "/path/to/project",
  timeout: 60000,
});

// Get output and exit code
const stdout = await handle.stdout; // string (accumulated)
const stderr = await handle.stderr; // string (accumulated)
const exitCode = await handle.exit; // number

// Kill process
handle.kill();
```

---

## Example: New File Extension

The **New File** extension is a built-in example in `packages/extension-new-file/`.

### Manifest

```typescript
{
  id: "hudhod.new-file",
  name: "New File",
  description: "Create a new file with Ctrl+N",
  activationEvents: ["onCommand:hudhod.newFile.create"],
  contributes: {
    commands: [
      { id: "hudhod.newFile.create", title: "New File", category: "File" }
    ],
    keybindings: [
      { command: "hudhod.newFile.create", key: "ctrl+n", mac: "cmd+n" }
    ]
  }
}
```

**Why these settings**:

- `onCommand:...` activation: Only load when user presses Ctrl+N
- Keybindings in manifest: Registered before activation so IDE can trigger it
- Specific category: Helps organize command palette

### Implementation

```typescript
activate(context) {
  context.subscriptions.push(
    context.hudhod.commands.registerCommand(
      "hudhod.newFile.create",
      async () => {
        const { window, fs } = context.hudhod;

        // Get target directory
        let dir = "/";
        if (window.activeEditor) {
          dir = dirname(window.activeEditor.path);
        }

        // Prompt for filename
        const filename = await window.showInputBox({
          title: "New File",
          placeholder: "src/index.ts",
          validate: (v) => v.trim() ? undefined : "Name required"
        });

        if (!filename) return;  // User cancelled

        // Create and open
        const path = joinPath(dir, filename.trim());
        await fs.createFile(path);
        await window.openFile(path);
        await window.showMessage(`Created: ${path}`, "info");
      }
    )
  );
}
```

**Flow**:

1. User presses Ctrl+N
2. IDE resolves keybinding → activates extension → executes command
3. Command prompts for filename (input box)
4. File is created and opened in editor
5. Success message shown

---

## Best Practices

### 1. Lazy Activation

Use specific activation events, not `onStartup`, to keep the IDE responsive.

```typescript
// ❌ Bad: Slows down IDE startup
activationEvents: ["onStartup"];

// ✅ Good: Load only when needed
activationEvents: ["onCommand:my.command", "onFileOpen:*.tsx"];
```

### 2. Minimal Dependencies

Limit npm dependencies to `@hudhod/sdk` only.

```json
{
  "dependencies": {
    "@hudhod/sdk": "workspace:*"
  }
}
```

If you need external libraries, bundle them:

```bash
npm install lodash
# In tsdown.config.ts, include it in rollup options
```

### 3. Error Handling

Always catch and report errors to the user.

```typescript
try {
  await hudhod.fs.createFile(path);
} catch (error) {
  await hudhod.window.showMessage(`Failed to create file: ${error}`, "error");
}
```

### 4. Input Validation

Validate user input before operations.

```typescript
const filename = await hudhod.window.showInputBox({
  validate: (value) => {
    if (!value.trim()) return "Filename required";
    if (value.includes("..")) return "Invalid path";
    if (value.includes("\0")) return "Invalid character";
    return undefined; // OK
  },
});
```

### 5. Keybinding Naming

Use platform-appropriate keybindings.

```typescript
// ✅ Good: Consider both platforms
keybindings: [
  { command: "my.save", key: "ctrl+s", mac: "cmd+s" },
  { command: "my.format", key: "shift+alt+f", mac: "shift+option+f" },
];

// ❌ Bad: Only Windows
keybindings: [{ command: "my.save", key: "ctrl+s" }];
```

### 6. Subscription Cleanup

Always dispose of subscriptions.

```typescript
activate(context) {
  // ✅ Good
  context.subscriptions.push(
    hudhod.fs.onDidChangeFile(() => { ... })
  );

  // ❌ Bad: Resource leak
  hudhod.fs.onDidChangeFile(() => { ... });  // Never disposed
}
```

### 7. Command Naming

Use reverse-domain notation for command IDs.

```typescript
// ✅ Good
"hudhod.new-file.create";
"hudhod.prettier.format";

// ❌ Bad: Generic
"create";
"format";
```

---

## Testing

To test your extension:

1. **Build**: `pnpm packages:build`
2. **Type check**: `pnpm typecheck`
3. **Register in IdeWorkspace.tsx**:
   ```typescript
   import myExtension from "@hudhod/extension-my-feature";

   ws.extensions.register(myExtension);
   ```
4. **Start dev server**: `pnpm dev`
5. **Test in browser**: Trigger activation events, verify commands and keybindings work

---

## Publishing

Future releases will support publishing to npm:

```bash
npm publish  # Publishes to @hudhod/extension-{name}
```

For now, extensions are installed by registering them in `lib/hudhod/workspace.ts`.

---

## References

- [SDK Types](packages/sdk/src/index.ts)
- [Built-in Extension Example](packages/extension-new-file/src/index.ts)
- [Extension Host Implementation](packages/core/src/extensions/extension-host.ts)
- [App Integration](lib/hudhod/workspace.ts)
