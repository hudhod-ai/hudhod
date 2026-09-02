import { describe, expect, it } from "vitest";

import { parseExtensionManifest } from "./manifest";

describe("parseExtensionManifest", () => {
  const valid = {
    id: "acme.todo-finder",
    name: "TODO Finder",
    version: "1.2.3",
  };

  it("accepts a minimal valid manifest", () => {
    expect(parseExtensionManifest(valid)).toEqual(valid);
  });

  it("accepts all supported contribution points", () => {
    const manifest = parseExtensionManifest({
      ...valid,
      description: "Finds TODOs",
      activationEvents: [
        "onStartup",
        "onCommand:acme.todo-finder.scan",
        "onFileOpen:**/*.ts",
        "onView:acme.todo-finder.panel",
      ],
      contributes: {
        commands: [
          {
            id: "acme.todo-finder.scan",
            title: "Scan for TODOs",
            category: "TODO Finder",
          },
        ],
        panels: [
          {
            id: "acme.todo-finder.panel",
            title: "TODOs",
            location: "right",
          },
        ],
        viewContainers: [
          { id: "acme.todo-finder", title: "TODO Finder", location: "left" },
        ],
        views: [
          {
            id: "acme.todo-finder.results",
            title: "Results",
            container: "acme.todo-finder",
            order: 10,
          },
        ],
      },
    });

    expect(manifest.contributes?.panels?.[0]?.location).toBe("right");
    expect(manifest.contributes?.views?.[0]?.container).toBe(
      "acme.todo-finder",
    );
  });

  it("rejects an id without a publisher segment", () => {
    expect(() =>
      parseExtensionManifest({ ...valid, id: "todo-finder" }),
    ).toThrow();
  });

  it("rejects uppercase ids", () => {
    expect(() =>
      parseExtensionManifest({ ...valid, id: "Acme.todo" }),
    ).toThrow();
  });

  it("rejects an invalid semver version", () => {
    expect(() =>
      parseExtensionManifest({ ...valid, version: "latest" }),
    ).toThrow();
  });

  it("rejects an unsupported activation event", () => {
    expect(() =>
      parseExtensionManifest({ ...valid, activationEvents: ["onNever"] }),
    ).toThrow();
  });

  it("rejects duplicate contributed command ids", () => {
    expect(() =>
      parseExtensionManifest({
        ...valid,
        contributes: {
          commands: [
            { id: "acme.todo.run", title: "Run" },
            { id: "acme.todo.run", title: "Run Again" },
          ],
        },
      }),
    ).toThrow(/unique/);
  });

  it("rejects duplicate contributed panel ids", () => {
    expect(() =>
      parseExtensionManifest({
        ...valid,
        contributes: {
          panels: [
            { id: "acme.todo.view", title: "One" },
            { id: "acme.todo.view", title: "Two" },
          ],
        },
      }),
    ).toThrow(/unique/);
  });

  it("rejects duplicate view and view container ids", () => {
    expect(() =>
      parseExtensionManifest({
        ...valid,
        contributes: {
          viewContainers: [
            { id: "acme.todo", title: "One" },
            { id: "acme.todo", title: "Two" },
          ],
          views: [
            { id: "acme.todo.results", title: "One", container: "other" },
            { id: "acme.todo.results", title: "Two", container: "other" },
          ],
        },
      }),
    ).toThrow(/unique/);
  });
});
