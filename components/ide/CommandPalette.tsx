"use client";

import type { CommandDescriptor } from "@hudhod/sdk";
import type { CommandRegistry } from "@hudhod/core";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type CommandPaletteProps = {
  commands: CommandRegistry | null;
  open: boolean;
  onOpenChange(open: boolean): void;
};

/** Searches and invokes commands registered in the current workspace. */
export function CommandPalette({
  commands,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<readonly CommandDescriptor[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  useEffect(() => {
    if (!commands) {
      setCatalog([]);
      return;
    }

    const refresh = () => {
      void commands.getCommands().then(setCatalog);
    };
    refresh();
    return commands.onDidChangeCommands(refresh).dispose;
  }, [commands]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const matches = catalog.filter((command) => {
    if (!deferredQuery) return true;
    return `${command.category ?? ""} ${command.title} ${command.id}`
      .toLocaleLowerCase()
      .includes(deferredQuery);
  });

  async function execute(command: CommandDescriptor) {
    if (!commands) return;
    onOpenChange(false);
    await commands.executeCommand(command.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-lg gap-3 p-3">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands"
          aria-label="Search commands"
        />
        <div className="max-h-80 overflow-y-auto" role="listbox">
          {matches.length > 0 ? (
            matches.map((command) => (
              <button
                key={command.id}
                type="button"
                role="option"
                onClick={() => void execute(command)}
                className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="min-w-0 truncate">{command.title}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {command.category ?? command.id}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-8 text-center text-sm text-zinc-500">
              No matching commands
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}