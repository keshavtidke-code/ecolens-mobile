import { ApiError, observationsApi, toApiError } from "@/api";
import { draftsDb } from "@/db/drafts";
import type { Draft } from "@/db/drafts";
import { deleteDraftPhoto, draftPhotoExists, persistDraftPhoto } from "./draftFiles";
import { prepareUploadPhoto, shrinkPhoto } from "./imageProcessing";
import { CancelledError, isCancelledError, JobRegistry, throwIfCancelled } from "./jobRegistry";
import type { JobSnapshot } from "./jobRegistry";

export type PipelineStep = "upload" | "analyze" | "lesson" | "done";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_MS = 90_000;

/** One job per draft: tracks status, joins duplicate starts, and supports cancellation. */
const pipelineJobs = new JobRegistry<number>();

/** Sleep that ends early (with CancelledError) when the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new CancelledError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Another request is already analysing this observation: wait for it instead of starting a second (billed) run. */
async function waitUntilAnalyzed(observationId: number, signal: AbortSignal): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < POLL_MAX_MS) {
    throwIfCancelled(signal);
    const { status, failure_reason } = await observationsApi.status(observationId, { signal });
    if (status === "complete") return;
    if (status === "failed") {
      throw new ApiError({ message: failure_reason ?? "The analysis failed.", code: "analysis_failed", status: 502 });
    }
    await sleep(POLL_INTERVAL_MS, signal);
  }
  throw new ApiError({ message: "The analysis is taking longer than expected.", code: "timeout" });
}

/** Swaps a re-encoded photo into the draft's permanent storage and removes the old file. */
async function replaceDraftPhoto(draft: Draft, newUri: string): Promise<string> {
  const stored = await persistDraftPhoto(newUri);
  deleteDraftPhoto(draft.photo_path);
  await draftsDb.update(draft.id, { photo_path: stored });
  return stored;
}

/** Older drafts (or very large ones) may exceed the size budget: re-encode before uploading. */
async function ensureUploadablePhoto(draft: Draft): Promise<string> {
  const prepared = await prepareUploadPhoto(draft.photo_path);
  return prepared.processed ? replaceDraftPhoto(draft, prepared.uri) : draft.photo_path;
}

async function uploadPhoto(draft: Draft, photoPath: string, signal: AbortSignal) {
  const send = (uri: string) =>
    observationsApi.create(
      {
        photoUri: uri,
        latitude: draft.latitude,
        longitude: draft.longitude,
        capturedAt: draft.captured_at,
        locationAccuracyM: draft.accuracy_m,
        photoSource: "camera",
        userNote: draft.note,
      },
      { signal },
    );
  try {
    return await send(photoPath);
  } catch (error) {
    const apiError = toApiError(error);
    // The server's size limit is final (HTTP 413 is not retryable as-is): shrink once more and try one last time.
    if (apiError.status === 413 || apiError.code === "photo_too_large") {
      throwIfCancelled(signal);
      const smaller = await shrinkPhoto(photoPath);
      const stored = await replaceDraftPhoto(draft, smaller.uri);
      return send(stored);
    }
    throw apiError;
  }
}

async function execute(
  draftId: number,
  signal: AbortSignal,
  setStep: (step: PipelineStep) => void,
): Promise<number> {
  const draft = await draftsDb.get(draftId);
  if (!draft) {
    throw new ApiError({ message: "This draft no longer exists.", code: "draft_missing" });
  }

  try {
    let observationId = draft.observation_id;
    let stage = draft.stage;

    if (observationId == null) {
      setStep("upload");
      if (!await draftPhotoExists(draft.photo_path)) {
        throw new ApiError({ message: "The photo for this draft is missing from the device.", code: "photo_missing" });
      }
      const photoPath = await ensureUploadablePhoto(draft);
      throwIfCancelled(signal);
      const observation = await uploadPhoto(draft, photoPath, signal);
      observationId = observation.id;
      stage = "uploaded";
      await draftsDb.update(draftId, { observation_id: observationId, stage, last_error: null });
    }

    throwIfCancelled(signal);
    if (stage !== "analyzed") {
      setStep("analyze");
      // A previous attempt may have finished on the server although the response was lost.
      const current = await observationsApi.status(observationId, { signal });
      if (current.status !== "complete") {
        try {
          await observationsApi.analyze(observationId, { signal });
        } catch (error) {
          const apiError = toApiError(error);
          if (apiError.code === "analysis_in_progress") await waitUntilAnalyzed(observationId, signal);
          else throw apiError;
        }
      }
      await draftsDb.update(draftId, { stage: "analyzed", last_error: null });
    }

    throwIfCancelled(signal);
    setStep("lesson");
    try {
      await observationsApi.learningExperience(observationId, undefined, false, { signal }); // idempotent; screens re-request it if this fails
    } catch (error) {
      if (toApiError(error).isCancelled) throw new CancelledError();
      /* otherwise non-fatal: the ecosystem result is already usable, the Lesson screen offers a retry */
    }

    deleteDraftPhoto(draft.photo_path);
    await draftsDb.remove(draftId);
    setStep("done");
    return observationId;
  } catch (error) {
    if (isCancelledError(error) || (error instanceof ApiError && error.isCancelled)) throw new CancelledError();
    const apiError = toApiError(error);
    await draftsDb.update(draftId, { last_error: apiError.message }).catch(() => undefined);
    throw apiError;
  }
}

/**
 * upload -> analyze -> lesson for one local draft. Safe to call again after any failure: each completed
 * stage is recorded on the draft, so a retry never re-uploads the photo or pays for the same step twice.
 * Resolves with the server-side observation id; the draft is removed on success.
 *
 * Single-flight per draft: calling again while it runs joins the running job (no duplicate billed run).
 * Rejects with CancelledError after cancelPipeline(); the draft is kept so it can be resumed later.
 */
export function runPipeline(draftId: number, onStep: (step: PipelineStep) => void): Promise<number> {
  const listener = (snapshot: JobSnapshot<number>) => {
    if (snapshot.step) onStep(snapshot.step as PipelineStep);
  };
  return pipelineJobs.start(
    String(draftId),
    ({ signal, setStep }) => execute(draftId, signal, (step) => setStep(step)),
    listener,
  );
}

/** Aborts the in-flight requests for this draft. Returns false if it wasn't running. */
export function cancelPipeline(draftId: number): boolean {
  return pipelineJobs.cancel(String(draftId));
}

export function isPipelineRunning(draftId: number): boolean {
  return pipelineJobs.isRunning(String(draftId));
}

/** Drops a draft and its local photo. Does not touch an observation that already exists on the server. */
export async function discardDraft(draftId: number): Promise<void> {
  cancelPipeline(draftId);
  const draft = await draftsDb.get(draftId);
  if (draft) deleteDraftPhoto(draft.photo_path);
  await draftsDb.remove(draftId);
}


