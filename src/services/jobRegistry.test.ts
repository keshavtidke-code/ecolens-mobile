import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CancelledError, isCancelledError, JobRegistry, throwIfCancelled } from "./jobRegistry.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("JobRegistry", () => {
  it("runs a job to success and records the final snapshot", async () => {
    const registry = new JobRegistry<number>();
    const result = await registry.start("a", async ({ setStep }) => {
      setStep("upload");
      return 42;
    });
    assert.equal(result, 42);
    const snap = registry.get("a");
    assert.equal(snap?.status, "succeeded");
    assert.equal(snap?.result, 42);
    assert.equal(snap?.step, "upload");
    assert.notEqual(snap?.finishedAt, null);
    assert.equal(registry.isRunning("a"), false);
  });

  it("joins a running job instead of starting a duplicate run", async () => {
    const registry = new JobRegistry<number>();
    const gate = deferred<number>();
    let calls = 0;
    const runner = () => {
      calls += 1;
      return gate.promise;
    };
    const first = registry.start("a", runner);
    const second = registry.start("a", runner);
    const third = registry.start("a", runner);
    assert.equal(calls, 1);
    gate.resolve(7);
    assert.deepEqual(await Promise.all([first, second, third]), [7, 7, 7]);
    assert.equal(calls, 1);
  });

  it("keeps different keys independent", async () => {
    const registry = new JobRegistry<string>();
    const [a, b] = await Promise.all([registry.start("a", async () => "A"), registry.start("b", async () => "B")]);
    assert.deepEqual([a, b], ["A", "B"]);
  });

  it("notifies listeners of step changes, including a joiner that attaches late", async () => {
    const registry = new JobRegistry<number>();
    const gate = deferred<number>();
    const seen: Array<string | null> = [];
    const lateSeen: Array<string | null> = [];
    const first = registry.start(
      "a",
      async ({ setStep }) => {
        setStep("upload");
        await tick();
        setStep("analyze");
        return gate.promise;
      },
      (s) => seen.push(s.step),
    );
    await tick();
    await tick();
    const joined = registry.start("a", async () => 0, (s) => lateSeen.push(s.step));
    assert.equal(lateSeen[0], "analyze"); // immediately told the current step
    gate.resolve(1);
    await Promise.all([first, joined]);
    assert.ok(seen.includes("upload") && seen.includes("analyze"));
  });

  it("cancel aborts the signal and the job rejects with CancelledError", async () => {
    const registry = new JobRegistry<number>();
    let sawAbort = false;
    const job = registry.start("a", async ({ signal }) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
      sawAbort = true;
      throwIfCancelled(signal);
      return 1;
    });
    await tick();
    assert.equal(registry.cancel("a"), true);
    assert.equal(registry.get("a")?.status, "cancelling");
    await assert.rejects(job, (e: unknown) => isCancelledError(e));
    assert.equal(sawAbort, true);
    assert.equal(registry.get("a")?.status, "cancelled");
    assert.equal(registry.isRunning("a"), false);
  });

  it("treats a runner that fails with an abort-caused error as cancelled, not failed", async () => {
    const registry = new JobRegistry<number>();
    const job = registry.start("a", async ({ signal }) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
      throw new Error("ERR_CANCELED from axios");
    });
    await tick();
    registry.cancel("a");
    await assert.rejects(job, CancelledError);
    assert.equal(registry.get("a")?.status, "cancelled");
  });

  it("reports success when the work finished despite a late cancel (the result is real; callers guard navigation)", async () => {
    const registry = new JobRegistry<number>();
    const gate = deferred<number>();
    const job = registry.start("a", () => gate.promise);
    registry.cancel("a");
    gate.resolve(5);
    assert.equal(await job, 5);
    assert.equal(registry.get("a")?.status, "succeeded");
  });

  it("cancel returns false when nothing is running", async () => {
    const registry = new JobRegistry<number>();
    assert.equal(registry.cancel("missing"), false);
    await registry.start("a", async () => 1);
    assert.equal(registry.cancel("a"), false);
  });

  it("does not start a second run while the cancelled one is still stopping; starts after it settles", async () => {
    const registry = new JobRegistry<number>();
    const order: string[] = [];
    const stopGate = deferred<void>();
    const first = registry.start("a", async ({ signal }) => {
      order.push("first:start");
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve()));
      await stopGate.promise; // slow to wind down
      order.push("first:stopped");
      throwIfCancelled(signal);
      return 1;
    });
    first.catch(() => undefined);
    await tick();
    registry.cancel("a");
    const second = registry.start("a", async () => {
      order.push("second:start");
      return 2;
    });
    await tick();
    assert.deepEqual(order, ["first:start"]); // second has NOT started yet
    stopGate.resolve();
    assert.equal(await second, 2);
    assert.deepEqual(order, ["first:start", "first:stopped", "second:start"]);
    assert.equal(registry.get("a")?.status, "succeeded");
  });

  it("records failures and allows a fresh start afterwards", async () => {
    const registry = new JobRegistry<number>();
    const boom = new Error("boom");
    await assert.rejects(registry.start("a", async () => { throw boom; }), /boom/);
    assert.equal(registry.get("a")?.status, "failed");
    assert.equal(registry.get("a")?.error, boom);
    assert.equal(await registry.start("a", async () => 9), 9);
    assert.equal(registry.get("a")?.status, "succeeded");
  });

  it("handles a runner that throws synchronously", async () => {
    const registry = new JobRegistry<number>();
    await assert.rejects(registry.start("a", (() => { throw new Error("sync"); }) as never), /sync/);
    assert.equal(registry.isRunning("a"), false);
  });

  it("a throwing listener never breaks the job", async () => {
    const registry = new JobRegistry<number>();
    const result = await registry.start("a", async ({ setStep }) => { setStep("x"); return 3; }, () => { throw new Error("listener"); });
    assert.equal(result, 3);
  });

  it("get returns null for unknown keys", () => {
    assert.equal(new JobRegistry<number>().get("nope"), null);
  });
});
