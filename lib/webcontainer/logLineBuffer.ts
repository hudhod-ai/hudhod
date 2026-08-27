import { CSI_RESET_FINAL_CHARS, CSI_TOKEN_PATTERN } from "./ansi";

// Splits a chunk into either a full ANSI escape sequence or a single plain character,
// so escape codes can be interpreted (not just deleted) before the rest is discarded.
// eslint-disable-next-line no-control-regex
const TOKEN_PATTERN =
  /\u001B\[[0-9;]*[A-Za-z]|\u001B\][\s\S]*?(?:\u0007|\u001B\\)|[\s\S]/g;

/**
 * Collapses raw terminal chunks into clean, newline-terminated log lines. Real spinners
 * (npm, yarn, etc.) redraw the current line with cursor-control escape codes like
 * `ESC[1G` (column 1) and `ESC[0K` (erase to end of line) rather than a literal `\r`, so
 * those are treated as "the buffered line is about to be overwritten" and discarded; a
 * literal `\r` not followed by `\n` is treated the same way. A `\r\n` pair (how a pty
 * renders a plain `\n`) still flushes one real line.
 *
 * `onProgress` reports the current (uncommitted) buffer after every update, so callers
 * can render spinner-driven activity live instead of it going silent until the next `\n`.
 */
export function createLineBuffer(
  onLine: (line: string) => void,
  onProgress?: (partial: string) => void,
) {
  let buffer = "";
  let pendingCarriageReturn = false;

  function flush() {
    if (buffer.length > 0) onLine(buffer);
    buffer = "";
    onProgress?.(buffer);
  }

  function reset() {
    buffer = "";
    onProgress?.(buffer);
  }

  function handleChar(char: string) {
    if (pendingCarriageReturn) {
      pendingCarriageReturn = false;
      if (char === "\n") {
        flush();
        return;
      }
      reset(); // lone \r: spinner-style overwrite, discard what was buffered.
    }

    if (char === "\r") {
      pendingCarriageReturn = true;
    } else if (char === "\n") {
      flush();
    } else {
      buffer += char;
      onProgress?.(buffer);
    }
  }

  return {
    push(chunk: string): void {
      const tokens = chunk.match(TOKEN_PATTERN) ?? [];
      for (const token of tokens) {
        if (token.charCodeAt(0) === 0x1b) {
          const finalChar = CSI_TOKEN_PATTERN.exec(token)?.[2];
          if (finalChar && CSI_RESET_FINAL_CHARS.has(finalChar)) reset();
          continue; // other escape sequences (colors, etc.) carry no visible text.
        }
        handleChar(token);
      }
    },
    /** Emits any content left in the buffer once the stream closes without a trailing newline. */
    flush,
  };
}
