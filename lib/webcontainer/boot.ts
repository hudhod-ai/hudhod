import { WebContainer } from "@webcontainer/api";

let bootPromise: Promise<WebContainer> | null = null;

/** Ensures WebContainer.boot() is only ever called once per page, even under StrictMode/HMR. */
export function getWebContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}
