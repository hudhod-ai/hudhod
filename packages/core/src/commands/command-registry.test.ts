import { describe, expect, it, vi } from "vitest";

import { CommandRegistry } from "./command-registry";

describe("CommandRegistry", () => {
  it("registers and executes a synchronous command", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand(
      "demo.sum",
      (left, right) => Number(left) + Number(right),
    );

    await expect(
      commands.executeCommand<number>("demo.sum", 2, 3),
    ).resolves.toBe(5);
  });

  it("awaits an asynchronous command", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand("demo.async", async () => "done");

    await expect(commands.executeCommand("demo.async")).resolves.toBe("done");
  });

  it("passes all arguments to the handler", async () => {
    const commands = new CommandRegistry();
    const handler = vi.fn();
    commands.registerCommand("demo.args", handler);

    await commands.executeCommand("demo.args", "one", 2, { three: true });

    expect(handler).toHaveBeenCalledExactlyOnceWith("one", 2, { three: true });
  });

  it("rejects a duplicate id", () => {
    const commands = new CommandRegistry();
    commands.registerCommand("demo.run", () => {});

    expect(() => commands.registerCommand("demo.run", () => {})).toThrowError(
      expect.objectContaining({ code: "CommandExists" }),
    );
  });

  it("rejects an unknown command", async () => {
    const commands = new CommandRegistry();

    await expect(commands.executeCommand("missing")).rejects.toThrowError(
      expect.objectContaining({ code: "CommandNotFound" }),
    );
  });

  it("unregisters on dispose", async () => {
    const commands = new CommandRegistry();
    const registration = commands.registerCommand("demo.run", () => {});

    registration.dispose();

    await expect(commands.executeCommand("demo.run")).rejects.toThrowError(
      expect.objectContaining({ code: "CommandNotFound" }),
    );
  });

  it("makes a registration disposable more than once", async () => {
    const commands = new CommandRegistry();
    const registration = commands.registerCommand("demo.run", () => {});

    registration.dispose();
    registration.dispose();

    expect(await commands.getCommands()).toEqual([]);
  });

  it("lists commands by title then id", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand("zebra", () => {}, { title: "Alpha" });
    commands.registerCommand("apple", () => {}, { title: "Alpha" });
    commands.registerCommand("mid", () => {}, { title: "Zulu" });

    expect((await commands.getCommands()).map((command) => command.id)).toEqual(
      ["apple", "zebra", "mid"],
    );
  });

  it("defaults the descriptor title to the id", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand("demo.run", () => {});

    expect(await commands.getCommands()).toEqual([
      { id: "demo.run", title: "demo.run" },
    ]);
  });

  it("retains category metadata", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand("demo.run", () => {}, {
      title: "Run",
      category: "Demo",
    });

    expect(await commands.getCommands()).toEqual([
      { id: "demo.run", title: "Run", category: "Demo" },
    ]);
  });

  it("fires when commands are added and removed", async () => {
    const commands = new CommandRegistry();
    const snapshots: string[][] = [];
    commands.onDidChangeCommands((catalog) =>
      snapshots.push(catalog.map((command) => command.id)),
    );

    const registration = commands.registerCommand("demo.run", () => {});
    await vi.waitFor(() => expect(snapshots).toEqual([["demo.run"]]));

    registration.dispose();
    await vi.waitFor(() => expect(snapshots).toEqual([["demo.run"], []]));
  });

  it("clears all commands on dispose", async () => {
    const commands = new CommandRegistry();
    commands.registerCommand("demo.run", () => {});

    commands.dispose();

    expect(await commands.getCommands()).toEqual([]);
  });
});
