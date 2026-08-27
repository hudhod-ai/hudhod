"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";

interface InputDialogProps {
  open: boolean;
  title: string;
  label: string;
  submitLabel: string;
  defaultValue?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
}

/** Generic single-field text prompt, used for new file/folder, rename and add-dependency flows. */
export function InputDialog({
  open,
  title,
  label,
  submitLabel,
  defaultValue = "",
  onOpenChange,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(defaultValue);
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-80 -translate-x-1/2 -translate-y-1/2 rounded-md border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <Dialog.Title className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              {label}
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500"
              >
                {submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
