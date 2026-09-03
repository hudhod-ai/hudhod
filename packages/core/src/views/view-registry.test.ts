import { describe, expect, it, vi } from "vitest";

import { ViewRegistry } from "./view-registry";

describe("ViewRegistry", () => {
  it("restores the previous registration when an override is disposed", () => {
    const views = new ViewRegistry();
    views.registerView({
      id: "outline",
      title: "Original",
      container: "explorer",
    });
    const override = views.registerView({
      id: "outline",
      title: "Override",
      container: "explorer",
    });

    expect(views.getViews()[0]?.title).toBe("Override");
    override.dispose();
    expect(views.getViews()[0]?.title).toBe("Original");
  });

  it("orders explicit values first and breaks ties by registration order", () => {
    const views = new ViewRegistry();
    views.registerView({ id: "later", title: "Later", container: "explorer" });
    views.registerView({
      id: "second",
      title: "Second",
      container: "explorer",
      order: 10,
    });
    views.registerView({
      id: "first",
      title: "First",
      container: "explorer",
      order: 10,
    });
    views.registerView({
      id: "zero",
      title: "Zero",
      container: "explorer",
      order: 0,
    });

    expect(views.getViews().map((view) => view.id)).toEqual(["zero", "second", "first", "later"]);
  });

  it("filters views by container", () => {
    const views = new ViewRegistry();
    views.registerView({
      id: "outline",
      title: "Outline",
      container: "explorer",
    });
    views.registerView({ id: "search", title: "Search", container: "search" });

    expect(views.getViewsForContainer("explorer").map((view) => view.id)).toEqual(["outline"]);
  });

  it("notifies changes and stops notifying after disposal", () => {
    const views = new ViewRegistry();
    const listener = vi.fn();
    views.onDidChangeViews(listener);
    views.registerView({
      id: "outline",
      title: "Outline",
      container: "explorer",
    });
    expect(listener).toHaveBeenCalledTimes(1);

    views.dispose();
    expect(listener).toHaveBeenCalledTimes(2);
    views.registerView({ id: "other", title: "Other", container: "explorer" });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
