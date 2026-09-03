import { describe, expect, it, vi } from "vitest";

import { PanelRegistry } from "./panel-registry";

describe("PanelRegistry", () => {
  it("registers a panel and defaults its location to bottom", () => {
    const panels = new PanelRegistry();

    panels.registerPanel({ id: "demo.logs", title: "Logs" }, { extensionId: "demo" });

    expect(panels.getPanels()).toEqual([
      {
        id: "demo.logs",
        title: "Logs",
        location: "bottom",
        source: "extension",
        extensionId: "demo",
      },
    ]);
  });

  it("honours an explicit location and a builtin source", () => {
    const panels = new PanelRegistry();

    panels.registerPanel(
      { id: "shell.explorer", title: "Explorer", location: "left" },
      { source: "builtin" },
    );

    expect(panels.getPanels()[0]).toMatchObject({
      location: "left",
      source: "builtin",
      extensionId: undefined,
    });
  });

  it("sorts panels by id", () => {
    const panels = new PanelRegistry();
    panels.registerPanel({ id: "c", title: "C" });
    panels.registerPanel({ id: "a", title: "A" });
    panels.registerPanel({ id: "b", title: "B" });

    expect(panels.getPanels().map((panel) => panel.id)).toEqual(["a", "b", "c"]);
  });

  it("lets the last registration win and restores the previous one on dispose", () => {
    const panels = new PanelRegistry();
    panels.registerPanel({ id: "demo.logs", title: "Original" });
    const override = panels.registerPanel({
      id: "demo.logs",
      title: "Override",
    });

    expect(panels.getPanels()).toHaveLength(1);
    expect(panels.getPanels()[0]?.title).toBe("Override");

    override.dispose();

    expect(panels.getPanels()[0]?.title).toBe("Original");
  });

  it("removes the panel once the only registration is disposed", () => {
    const panels = new PanelRegistry();
    const sub = panels.registerPanel({ id: "demo.logs", title: "Logs" });

    sub.dispose();

    expect(panels.getPanels()).toEqual([]);
  });

  it("ignores a repeated dispose", () => {
    const panels = new PanelRegistry();
    panels.registerPanel({ id: "demo.logs", title: "Original" });
    const override = panels.registerPanel({
      id: "demo.logs",
      title: "Override",
    });

    override.dispose();
    override.dispose();

    expect(panels.getPanels()).toHaveLength(1);
    expect(panels.getPanels()[0]?.title).toBe("Original");
  });

  it("fires onDidChangePanels when panels are added and removed", () => {
    const panels = new PanelRegistry();
    const listener = vi.fn();
    panels.onDidChangePanels(listener);

    const sub = panels.registerPanel({ id: "demo.logs", title: "Logs" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toHaveLength(1);

    sub.dispose();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1]?.[0]).toHaveLength(0);
  });

  it("clears every panel and stops notifying on dispose", () => {
    const panels = new PanelRegistry();
    const listener = vi.fn();
    panels.onDidChangePanels(listener);
    panels.registerPanel({ id: "demo.logs", title: "Logs" });
    listener.mockClear();

    panels.dispose();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(panels.getPanels()).toEqual([]);

    listener.mockClear();
    panels.registerPanel({ id: "demo.other", title: "Other" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify when disposing an empty registry", () => {
    const panels = new PanelRegistry();
    const listener = vi.fn();
    panels.onDidChangePanels(listener);

    panels.dispose();

    expect(listener).not.toHaveBeenCalled();
  });
});
