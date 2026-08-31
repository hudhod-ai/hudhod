import type { ProcessInfo } from "@hudhod/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeProcessSpawner } from "./fake-spawner";
import { ProcessService } from "./process-service";

async function drain(stream: ReadableStream<string>): Promise<string> {
  let text = "";
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += value ?? "";
  }
  return text;
}

describe("ProcessService", () => {
  let spawner: FakeProcessSpawner;
  let service: ProcessService;

  beforeEach(() => {
    spawner = new FakeProcessSpawner();
    service = new ProcessService(spawner);
  });

  describe("spawn", () => {
    it("returns a handle describing the process", async () => {
      spawner.register("node", { output: ["v22.0.0\n"] });

      const handle = await service.spawn("node", ["-v"]);

      expect(handle.command).toBe("node");
      expect(handle.args).toEqual(["-v"]);
      expect(handle.id).toBeTruthy();
    });

    it("streams output", async () => {
      spawner.register("echo", { output: ["hello ", "world"] });

      const handle = await service.spawn("echo");

      expect(await drain(handle.output)).toBe("hello world");
    });

    it("passes options through to the backend", async () => {
      await service.spawn("node", ["-v"], {
        cwd: "/src",
        env: { NODE_ENV: "test" },
      });

      expect(spawner.spawns[0]?.options).toMatchObject({
        cwd: "/src",
        env: { NODE_ENV: "test" },
      });
    });

    it("assigns a distinct id to each process", async () => {
      const first = await service.spawn("a");
      const second = await service.spawn("b");

      expect(first.id).not.toBe(second.id);
    });

    it("supports several concurrent processes", async () => {
      spawner.register("server", { neverExits: true });

      await service.spawn("server", ["one"]);
      await service.spawn("server", ["two"]);

      const running = await service.list();
      expect(running).toHaveLength(2);
      expect(running.every((info) => info.status === "running")).toBe(true);
    });
  });

  describe("exec", () => {
    it("buffers output and reports the exit code", async () => {
      spawner.register("node", { output: ["v22.0.0\n"], exitCode: 0 });

      const result = await service.exec("node", ["-v"]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe("v22.0.0\n");
      expect(result.truncated).toBe(false);
    });

    it("reports a non-zero exit code rather than throwing", async () => {
      spawner.register("false", { exitCode: 1 });

      expect((await service.exec("false")).exitCode).toBe(1);
    });

    it("measures duration", async () => {
      let clock = 1000;
      const timed = new ProcessService(spawner, {
        now: () => {
          const current = clock;
          clock += 250;
          return current;
        },
      });
      spawner.register("slow", { output: ["x"] });

      expect((await timed.exec("slow")).durationMs).toBeGreaterThan(0);
    });

    it("concatenates multiple output chunks", async () => {
      spawner.register("cat", { output: ["a", "b", "c"] });

      expect((await service.exec("cat")).output).toBe("abc");
    });

    describe("timeout guard", () => {
      it("kills a runaway command and throws ProcessTimeout", async () => {
        spawner.register("server", { neverExits: true });

        await expect(service.exec("server", [], { timeout: 20 })).rejects.toThrowError(
          expect.objectContaining({ code: "ProcessTimeout" }),
        );
      });

      it("carries the partial output on the error", async () => {
        spawner.register("server", {
          output: ["partial output"],
          neverExits: true,
        });

        await expect(service.exec("server", [], { timeout: 20 })).rejects.toThrowError(
          expect.objectContaining({ partialOutput: "partial output" }),
        );
      });

      it("marks the process as no longer running", async () => {
        spawner.register("server", { neverExits: true });

        await service.exec("server", [], { timeout: 20 }).catch(() => {});

        const [info] = await service.list();
        expect(info?.status).not.toBe("running");
      });

      it("does not fire for a command that finishes in time", async () => {
        spawner.register("quick", { output: ["done"] });

        await expect(service.exec("quick", [], { timeout: 5000 })).resolves.toMatchObject({
          output: "done",
        });
      });

      it("can be disabled with false", async () => {
        spawner.register("slow", { output: ["done"], delayMs: 30 });

        await expect(service.exec("slow", [], { timeout: false })).resolves.toMatchObject({
          output: "done",
        });
      });
    });

    describe("output cap", () => {
      it("kills the process and throws when exceeded", async () => {
        spawner.register("noisy", { output: ["x".repeat(500)] });

        await expect(service.exec("noisy", [], { maxOutputBytes: 100 })).rejects.toThrowError(
          expect.objectContaining({ code: "OutputLimitExceeded" }),
        );
      });

      it("carries the partial output on the error", async () => {
        spawner.register("noisy", { output: ["x".repeat(500)] });

        const error = await service
          .exec("noisy", [], { maxOutputBytes: 100 })
          .catch((thrown: unknown) => thrown);

        expect(error).toMatchObject({ partialOutput: "x".repeat(500) });
      });

      it("counts bytes, not characters, so multi-byte output is capped correctly", async () => {
        // Each emoji is 4 bytes; 30 of them exceeds a 100-byte cap.
        spawner.register("emoji", { output: ["🎉".repeat(30)] });

        await expect(service.exec("emoji", [], { maxOutputBytes: 100 })).rejects.toThrowError(
          expect.objectContaining({ code: "OutputLimitExceeded" }),
        );
      });

      it("allows output below the cap", async () => {
        spawner.register("quiet", { output: ["small"] });

        await expect(service.exec("quiet", [], { maxOutputBytes: 100 })).resolves.toMatchObject({
          output: "small",
          truncated: false,
        });
      });

      it("can be disabled with false", async () => {
        spawner.register("noisy", { output: ["x".repeat(5000)] });

        await expect(service.exec("noisy", [], { maxOutputBytes: false })).resolves.toMatchObject({
          truncated: false,
        });
      });
    });
  });

  describe("list", () => {
    it("is empty before anything runs", async () => {
      expect(await service.list()).toEqual([]);
    });

    it("reports a finished process with its exit code", async () => {
      spawner.register("node", { output: ["v22\n"], exitCode: 0 });

      await service.exec("node", ["-v"]);

      const [info] = await service.list();
      expect(info).toMatchObject({ status: "exited", exitCode: 0 });
    });

    it("returns snapshots that later mutation cannot affect", async () => {
      spawner.register("server", { neverExits: true });
      await service.spawn("server");

      const before = await service.list();
      await service.kill(before[0]!.id);

      expect(before[0]?.status).toBe("running");
    });
  });

  describe("kill", () => {
    it("terminates a running process", async () => {
      spawner.register("server", { neverExits: true });
      const handle = await service.spawn("server");

      expect(await service.kill(handle.id)).toBe(true);

      const [info] = await service.list();
      expect(info?.status).toBe("killed");
    });

    it("reports false for an unknown id", async () => {
      expect(await service.kill("nope")).toBe(false);
    });

    it("reports false for an already-finished process", async () => {
      spawner.register("node", { output: ["v22\n"] });
      await service.exec("node", ["-v"]);
      const [info] = await service.list();

      expect(await service.kill(info!.id)).toBe(false);
    });

    it("can be triggered from the handle", async () => {
      spawner.register("server", { neverExits: true });
      const handle = await service.spawn("server");

      handle.kill();
      await vi.waitFor(async () => {
        const [info] = await service.list();
        expect(info?.status).toBe("killed");
      });
    });
  });

  describe("events", () => {
    it("fires onDidStartProcess", async () => {
      const started: ProcessInfo[] = [];
      service.onDidStartProcess((info) => started.push(info));
      spawner.register("node", { output: ["v22\n"] });

      await service.spawn("node", ["-v"]);

      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({ command: "node", status: "running" });
    });

    it("fires onDidExitProcess with the exit code", async () => {
      const exited: ProcessInfo[] = [];
      service.onDidExitProcess((info) => exited.push(info));
      spawner.register("node", { output: ["v22\n"], exitCode: 3 });

      await service.exec("node", ["-v"]);

      await vi.waitFor(() => expect(exited).toHaveLength(1));
      expect(exited[0]).toMatchObject({ exitCode: 3 });
    });

    it("fires onDidExitProcess exactly once, even when killed", async () => {
      const exited: ProcessInfo[] = [];
      service.onDidExitProcess((info) => exited.push(info));
      spawner.register("server", { neverExits: true });
      const handle = await service.spawn("server");

      await service.kill(handle.id);
      await handle.exit;
      await vi.waitFor(() => expect(exited).toHaveLength(1));

      expect(exited).toHaveLength(1);
    });
  });

  describe("dispose", () => {
    it("kills everything still running", async () => {
      spawner.register("server", { neverExits: true });
      const handle = await service.spawn("server");

      service.dispose();

      await expect(handle.exit).resolves.toBeTypeOf("number");
    });
  });
});
