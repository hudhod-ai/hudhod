"use client";

import type { IDockviewPanelProps } from "dockview-react";

import { useExtensionPanelStore } from "@/store/useExtensionPanelStore";
import { ExtensionRendererMount } from "./ExtensionRendererMount";

/** Mounts an extension's renderer into a real Dockview panel, keyed by `props.api.id`. */
export function ExtensionPanelHost(props: IDockviewPanelProps) {
  const entry = useExtensionPanelStore((state) =>
    state.renderers.get(props.api.id),
  );
  return entry ? <ExtensionRendererMount render={entry.render} /> : null;
}
