/**
 * `@hudhod/react` — React bindings for hudhod extensions.
 *
 * Extensions written in React use {@link registerReactPanel} instead of the raw
 * `hudhod.window.registerPanel` DOM callback: it owns the React root lifecycle and
 * exposes the {@link HudhodApi} to the tree through {@link useHudhod}.
 *
 * @packageDocumentation
 */

import type { Disposable, HudhodApi, RegisterPanelOptions } from "@hudhod/sdk";
import { createContext, useContext } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";

const HudhodContext = createContext<HudhodApi | undefined>(undefined);

/** Makes the hudhod API available to a React tree. */
export function HudhodProvider({
  value,
  children,
}: {
  readonly value: HudhodApi;
  readonly children: ReactNode;
}) {
  return (
    <HudhodContext.Provider value={value}>{children}</HudhodContext.Provider>
  );
}

/**
 * Reads the hudhod API from context.
 *
 * @throws `Error` when called outside a {@link HudhodProvider}.
 */
export function useHudhod(): HudhodApi {
  const hudhod = useContext(HudhodContext);
  if (!hudhod) {
    throw new Error(
      "useHudhod must be called inside a <HudhodProvider>. Panels registered with registerReactPanel are wrapped automatically.",
    );
  }
  return hudhod;
}

/**
 * Registers a panel whose content is a React component.
 *
 * The component is mounted into its own React root when the panel opens and
 * unmounted when the panel closes or the returned {@link Disposable} is disposed.
 *
 * @example
 * ```tsx
 * export function activate(context: ExtensionContext) {
 *   context.subscriptions.push(
 *     registerReactPanel(context.hudhod, "demo.logs", LogsPanel, { title: "Logs" }),
 *   );
 * }
 * ```
 */
export function registerReactPanel(
  hudhod: HudhodApi,
  id: string,
  Component: ComponentType,
  options: RegisterPanelOptions,
): Disposable {
  return hudhod.window.registerPanel(
    id,
    (container) => {
      const root = createRoot(container);
      root.render(
        <HudhodProvider value={hudhod}>
          <Component />
        </HudhodProvider>,
      );
      // Deferred so unmount never runs inside React's own render phase.
      return () => queueMicrotask(() => root.unmount());
    },
    options,
  );
}
