/**
 * Keybinding key sequence parsing and normalization.
 *
 * Keybindings are platform-independent at the manifest level; resolution to the
 * current platform happens at runtime. This module defines how to parse and
 * canonicalize key sequences.
 *
 * @packageDocumentation
 */

/**
 * A parsed and normalized key sequence.
 *
 * Modifiers are always in a canonical order: ctrl/cmd, shift, alt.
 */
export interface NormalizedKeybinding {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

/**
 * Parses a keybinding string like `"ctrl+shift+p"` into components.
 *
 * @throws Error when the syntax is malformed.
 * @example
 * parseKeybinding("ctrl+n") => { ctrl: true, shift: false, alt: false, key: "n" }
 * parseKeybinding("cmd+shift+k") => { ctrl: true, shift: true, alt: false, key: "k" }
 */
export function parseKeybinding(binding: string): NormalizedKeybinding {
  const parts = binding.toLowerCase().split("+");
  if (parts.length < 1) {
    throw new Error(`Keybinding must have at least a key: ${binding}`);
  }

  const normalized: NormalizedKeybinding = {
    ctrl: false,
    shift: false,
    alt: false,
    key: "",
  };

  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i];
    if (mod === "ctrl") normalized.ctrl = true;
    else if (mod === "cmd" || mod === "meta") normalized.ctrl = true;
    else if (mod === "shift") normalized.shift = true;
    else if (mod === "alt") normalized.alt = true;
    else {
      throw new Error(`Unknown modifier '${mod}' in keybinding: ${binding}`);
    }
  }

  const keyPart = parts[parts.length - 1];
  if (!keyPart) {
    throw new Error(`Keybinding must end with a key: ${binding}`);
  }
  normalized.key = keyPart;

  return normalized;
}

/**
 * Converts a {@link NormalizedKeybinding} back to a canonical string.
 *
 * @example
 * keybindingToString({ ctrl: true, shift: true, alt: false, key: "p" }) => "ctrl+shift+p"
 */
export function keybindingToString(binding: NormalizedKeybinding): string {
  const parts: string[] = [];
  if (binding.ctrl) parts.push("ctrl");
  if (binding.shift) parts.push("shift");
  if (binding.alt) parts.push("alt");
  parts.push(binding.key);
  return parts.join("+");
}

/**
 * Resolves a keyboard event to a canonical key string, or `undefined` if no binding.
 *
 * Returns a string like `"ctrl+shift+p"` that can be matched against registered bindings.
 */
export function keybindingFromEvent(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("ctrl");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}
