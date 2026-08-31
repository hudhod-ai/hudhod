import { describe, expect, it, vi } from "vitest";

import {
  ServiceRegistry,
  createServiceIdentifier,
} from "./service-registry";

describe("ServiceRegistry", () => {
  it("constructs services lazily", () => {
    const identifier = createServiceIdentifier<{ value: string }>("demo");
    const factory = vi.fn(() => ({ value: "created" }));
    const services = new ServiceRegistry();
    services.register(identifier, factory);

    expect(factory).not.toHaveBeenCalled();

    expect(services.get(identifier)).toEqual({ value: "created" });
    expect(factory).toHaveBeenCalledOnce();
  });

  it("returns the same singleton instance on every get", () => {
    const identifier = createServiceIdentifier<object>("demo");
    const services = new ServiceRegistry();
    services.register(identifier, () => ({}));

    expect(services.get(identifier)).toBe(services.get(identifier));
  });

  it("passes the registry into a factory for dependency resolution", () => {
    const dependencyId = createServiceIdentifier<{ value: number }>(
      "dependency",
    );
    const parentId = createServiceIdentifier<{ child: number }>("parent");
    const services = new ServiceRegistry();
    services.register(dependencyId, () => ({ value: 42 }));
    services.register(parentId, (registry) => ({
      child: registry.get(dependencyId).value,
    }));

    expect(services.get(parentId)).toEqual({ child: 42 });
  });

  it("identifiers with the same description remain distinct", () => {
    const first = createServiceIdentifier<string>("same");
    const second = createServiceIdentifier<string>("same");
    const services = new ServiceRegistry();
    services.register(first, () => "first");
    services.register(second, () => "second");

    expect(services.get(first)).toBe("first");
    expect(services.get(second)).toBe("second");
  });

  it("reports registered services", () => {
    const identifier = createServiceIdentifier<object>("demo");
    const services = new ServiceRegistry();

    expect(services.has(identifier)).toBe(false);
    services.register(identifier, () => ({}));
    expect(services.has(identifier)).toBe(true);
  });

  it("rejects duplicate registration", () => {
    const identifier = createServiceIdentifier<object>("demo");
    const services = new ServiceRegistry();
    services.register(identifier, () => ({}));

    expect(() => services.register(identifier, () => ({}))).toThrow(
      "Service already registered: demo",
    );
  });

  it("rejects getting an unknown service", () => {
    const services = new ServiceRegistry();

    expect(() => services.get(createServiceIdentifier("missing"))).toThrow(
      "Service not registered: missing",
    );
  });

  it("disposes created disposable services", () => {
    const identifier = createServiceIdentifier<{ dispose: () => void }>("demo");
    const dispose = vi.fn();
    const services = new ServiceRegistry();
    services.register(identifier, () => ({ dispose }));
    services.get(identifier);

    services.dispose();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("does not construct services that were never requested before disposal", () => {
    const identifier = createServiceIdentifier<object>("demo");
    const factory = vi.fn(() => ({}));
    const services = new ServiceRegistry();
    services.register(identifier, factory);

    services.dispose();

    expect(factory).not.toHaveBeenCalled();
  });

  it("disposes services in reverse creation order", () => {
    const firstId = createServiceIdentifier<{ dispose: () => void }>("first");
    const secondId = createServiceIdentifier<{ dispose: () => void }>("second");
    const order: string[] = [];
    const services = new ServiceRegistry();
    services.register(firstId, () => ({ dispose: () => order.push("first") }));
    services.register(secondId, () => ({
      dispose: () => order.push("second"),
    }));
    services.get(firstId);
    services.get(secondId);

    services.dispose();

    expect(order).toEqual(["second", "first"]);
  });

  it("rejects all access after disposal", () => {
    const identifier = createServiceIdentifier<object>("demo");
    const services = new ServiceRegistry();
    services.dispose();

    expect(() => services.register(identifier, () => ({}))).toThrow("disposed");
    expect(() => services.get(identifier)).toThrow("disposed");
  });

  it("is safe to dispose repeatedly", () => {
    const services = new ServiceRegistry();

    expect(() => {
      services.dispose();
      services.dispose();
    }).not.toThrow();
  });
});
