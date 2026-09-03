import type { Disposable, Event, ViewContribution } from "@hudhod/sdk";

import { Emitter } from "../base/event";

export interface ViewInfo {
  readonly id: string;
  readonly title: string;
  readonly container: string;
  readonly order?: number;
  readonly source: "extension" | "builtin";
  readonly extensionId?: string;
  readonly registrationOrder: number;
}

/** Tracks contributed views independently from activity-bar containers. */
export class ViewRegistry implements Disposable {
  readonly #stack = new Map<string, ViewInfo[]>();
  readonly #changeEmitter = new Emitter<readonly ViewInfo[]>();
  #nextRegistrationOrder = 0;

  readonly onDidChangeViews: Event<readonly ViewInfo[]> = (listener) =>
    this.#changeEmitter.event(listener);

  registerView(
    contribution: ViewContribution,
    options?: { source?: "extension" | "builtin"; extensionId?: string },
  ): Disposable {
    const info: ViewInfo = {
      ...contribution,
      source: options?.source ?? "extension",
      extensionId: options?.extensionId,
      registrationOrder: this.#nextRegistrationOrder++,
    };
    const stack = this.#stack.get(info.id) ?? [];
    this.#stack.set(info.id, stack);
    stack.push(info);
    this.#fireChange();

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        const current = this.#stack.get(info.id);
        if (!current) return;
        const index = current.indexOf(info);
        if (index >= 0) current.splice(index, 1);
        if (current.length === 0) this.#stack.delete(info.id);
        this.#fireChange();
      },
    };
  }

  getViews(): readonly ViewInfo[] {
    const result = [...this.#stack.values()]
      .map((stack) => stack.at(-1))
      .filter((view): view is ViewInfo => view !== undefined);
    // oxlint-disable-next-line unicorn/no-array-sort -- Array#toSorted is not available in the active TypeScript lib.
    return result.sort((left, right) => {
      if (left.order === undefined && right.order !== undefined) return 1;
      if (left.order !== undefined && right.order === undefined) return -1;
      if (left.order !== undefined && right.order !== undefined && left.order !== right.order) {
        return left.order - right.order;
      }
      return left.registrationOrder - right.registrationOrder;
    });
  }

  getViewsForContainer(containerId: string): readonly ViewInfo[] {
    return this.getViews().filter((view) => view.container === containerId);
  }

  dispose(): void {
    const changed = this.#stack.size > 0;
    this.#stack.clear();
    if (changed) this.#fireChange();
    this.#changeEmitter.dispose();
  }

  #fireChange(): void {
    this.#changeEmitter.fire(this.getViews());
  }
}
