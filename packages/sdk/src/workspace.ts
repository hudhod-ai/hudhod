/**
 * Workspace API types, including the agent-facing edit model.
 *
 * @packageDocumentation
 */

import type { Event } from "./lifecycle";

/** A range within a text document, using zero-based line and character offsets. */
export interface Range {
  /** Zero-based start line. */
  readonly startLine: number;
  /** Zero-based start character offset, in UTF-16 code units. */
  readonly startCharacter: number;
  /** Zero-based end line. */
  readonly endLine: number;
  /** Zero-based end character offset, in UTF-16 code units. */
  readonly endCharacter: number;
}

/** Replaces `range` with `text`. Omit `range` to replace the whole file. */
export interface TextEdit {
  /** The region to replace. When absent, the entire file is replaced. */
  readonly range?: Range;
  /** The replacement text. Use an empty string to delete. */
  readonly text: string;
}

/** A set of edits applied to one file. */
export interface FileEdit {
  /** Absolute path of the file to modify. */
  readonly path: string;
  /** Edits to apply, resolved against the file's original content. */
  readonly edits: readonly TextEdit[];
}

/**
 * How an edit should reach the user.
 *
 * - `immediate` — apply straight away. The change is recorded in the edit
 *   history and can be reverted, and lands in the editor's undo stack when the
 *   file is open.
 * - `review` — show the user a diff and wait. Nothing is written unless they
 *   accept.
 */
export type EditMode = "immediate" | "review";

/** Options for {@link WorkspaceApi.applyEdit}. */
export interface ApplyEditOptions {
  /**
   * Whether to apply the edit directly or ask the user first.
   * @defaultValue "immediate"
   */
  readonly mode?: EditMode;
  /** Human-readable description, shown in review UI and the edit history. */
  readonly label?: string;
}

/** The outcome of an {@link WorkspaceApi.applyEdit} call. */
export interface ApplyEditResult {
  /** Whether the edit was written to disk. `false` when the user rejected a review. */
  readonly applied: boolean;
  /** Paths that were modified. */
  readonly paths: readonly string[];
  /**
   * Identifier for this change in the edit history. Pass to
   * {@link WorkspaceApi.revertEdit} to undo it.
   */
  readonly editId?: string;
}

/** A recorded workspace edit, retained so it can be reverted. */
export interface EditHistoryEntry {
  /** Unique identifier for the change. */
  readonly id: string;
  /** Description supplied when the edit was applied. */
  readonly label: string;
  /** When the edit was applied, in milliseconds since the Unix epoch. */
  readonly timestamp: number;
  /** Paths the edit touched. */
  readonly paths: readonly string[];
  /** Whether the change has since been reverted. */
  readonly reverted: boolean;
}

/**
 * Workspace-level operations: roots, snapshots, and edits.
 *
 * @example Applying an agent edit the user must approve
 * ```ts
 * const result = await hudhod.workspace.applyEdit(
 *   [{ path: "/src/index.ts", edits: [{ text: nextSource }] }],
 *   { mode: "review", label: "Add error handling" },
 * );
 * ```
 */
export interface WorkspaceApi {
  /** Absolute path of the workspace root. */
  readonly rootPath: string;

  /**
   * Applies edits across one or more files.
   *
   * Edits within a single file are applied bottom-up so earlier ranges stay
   * valid. The whole set is atomic: if any file fails, none are written.
   */
  applyEdit(edits: readonly FileEdit[], options?: ApplyEditOptions): Promise<ApplyEditResult>;

  /** Undoes a previously applied edit, restoring the prior contents. */
  revertEdit(editId: string): Promise<boolean>;

  /** Returns the recorded edit history, newest first. */
  editHistory(): Promise<EditHistoryEntry[]>;

  /** Fires after any workspace edit is applied or reverted. */
  readonly onDidApplyEdit: Event<EditHistoryEntry>;
}
