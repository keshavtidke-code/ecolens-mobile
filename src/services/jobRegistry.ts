/**
 * Tracks long-running jobs (e.g. the upload -> analyze -> lesson pipeline) by key.
 *  - Single-flight: starting a job that is already running JOINS it; it never starts a second (billed) run.
 *  - Cancellable: cancel() aborts the job's AbortSignal; the job's promise rejects with CancelledError.
 *  - Observable: status + current step are queryable and subscribable, so a screen that remounts can reattach.
 * No React Native imports: unit-tested under plain Node.
 */

export type JobStatus = "running" | "cancelling" | "succeeded" | "failed" | "cancelled";

export class CancelledError extends Error {
  constructor(message: string = "Cancelled.") {
    super(message);
    this.name = "CancelledError";
  }
}

export function isCancelledError(error: unknown): boolean {
  return error instanceof CancelledError || (error as { name?: string } | null)?.name === "CancelledError";
}

/** Call between stages of a job so a cancel takes effect at the next safe point. */
export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new CancelledError();
}

export interface JobSnapshot<T> {
  key: string;
  status: JobStatus;
  step: string | null;
  result?: T;
  error?: unknown;
  startedAt: number;
  finishedAt: number | null;
}

export interface JobContext {
  signal: AbortSignal;
  setStep: (step: string) => void;
}

type Listener<T> = (snapshot: JobSnapshot<T>) => void;

interface Job<T> {
  snapshot: JobSnapshot<T>;
  controller: AbortController;
  promise: Promise<T>;
  /** Resolves when the job has fully stopped, whatever the outcome (never rejects). */
  settled: Promise<void>;
  listeners: Set<Listener<T>>;
}

export class JobRegistry<T> {
  private jobs = new Map<string, Job<T>>();
  private last = new Map<string, JobSnapshot<T>>();

  /**
   * Starts the job, or joins the running one. If the previous run for this key is still winding down after a
   * cancel, waits for it to stop first so two runs never overlap.
   */
  start(key: string, runner: (context: JobContext) => Promise<T>, listener?: Listener<T>): Promise<T> {
    const existing = this.jobs.get(key);
    if (existing && existing.snapshot.status === "running") {
      if (listener) {
        existing.listeners.add(listener);
        listener(existing.snapshot);
      }
      return existing.promise;
    }
    if (existing) {
      // "cancelling": let it stop, then begin fresh.
      return existing.settled.then(() => this.start(key, runner, listener));
    }
    return this.launch(key, runner, listener);
  }

  /** Requests cancellation. Returns false if there was nothing running for this key. */
  cancel(key: string): boolean {
    const job = this.jobs.get(key);
    if (!job || job.snapshot.status !== "running") return false;
    job.snapshot = { ...job.snapshot, status: "cancelling" };
    this.notify(job);
    job.controller.abort();
    return true;
  }

  isRunning(key: string): boolean {
    const status = this.jobs.get(key)?.snapshot.status;
    return status === "running" || status === "cancelling";
  }

  /** Live snapshot for a running job, or the final snapshot of the most recent finished one. */
  get(key: string): JobSnapshot<T> | null {
    return this.jobs.get(key)?.snapshot ?? this.last.get(key) ?? null;
  }

  private launch(key: string, runner: (context: JobContext) => Promise<T>, listener?: Listener<T>): Promise<T> {
    const controller = new AbortController();
    const job = {
      snapshot: { key, status: "running", step: null, startedAt: Date.now(), finishedAt: null } as JobSnapshot<T>,
      controller,
      listeners: new Set<Listener<T>>(),
    } as Job<T>;
    if (listener) job.listeners.add(listener);
    this.jobs.set(key, job);
    this.notify(job);

    const setStep = (step: string) => {
      if (job.snapshot.status !== "running") return;
      job.snapshot = { ...job.snapshot, step };
      this.notify(job);
    };

    const finish = (patch: Partial<JobSnapshot<T>>) => {
      job.snapshot = { ...job.snapshot, ...patch, finishedAt: Date.now() };
      this.jobs.delete(key);
      this.last.set(key, job.snapshot);
      this.notify(job);
      job.listeners.clear();
    };

    job.promise = (async () => {
      try {
        const result = await runner({ signal: controller.signal, setStep });
        // If the work finished despite a late cancel, the result is real and valid: report success.
        finish({ status: "succeeded", result });
        return result;
      } catch (error) {
        if (controller.signal.aborted || isCancelledError(error)) {
          finish({ status: "cancelled", error: new CancelledError() });
          throw new CancelledError();
        }
        finish({ status: "failed", error });
        throw error;
      }
    })();
    job.settled = job.promise.then(
      () => undefined,
      () => undefined,
    );
    return job.promise;
  }

  private notify(job: Job<T>): void {
    for (const listener of job.listeners) {
      try {
        listener(job.snapshot);
      } catch {
        /* a misbehaving listener must not break the job */
      }
    }
  }
}
