// Matches ANSI CSI/OSC escape sequences (cursor moves, color codes, clear-line, etc).
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PRZcf-ntqry=><~]))/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

// A single CSI escape sequence, captured as its own token: ESC [ params finalChar.
// eslint-disable-next-line no-control-regex
export const CSI_TOKEN_PATTERN = /\u001B\[([0-9;]*)([A-Za-z])/;

/**
 * CSI final characters that reposition the cursor or erase part of the terminal —
 * i.e. "what follows overwrites what came before" (spinners, progress bars).
 * G = cursor to column, K = erase in line, A = cursor up, J = erase in display.
 */
export const CSI_RESET_FINAL_CHARS = new Set(["G", "K", "A", "J"]);
