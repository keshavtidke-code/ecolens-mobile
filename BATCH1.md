# Batch 1 hardening: status

The uploaded archive contained **only the mobile app**. The FastAPI backend was not included, so every
server-side requirement is specified below but NOT implemented. Mobile-side work is done.

## How to verify (nothing below has been run on a device)

```
npm install && npx expo install expo-image-manipulator   # confirms the SDK-matched version
npm test            # 47 dependency-free unit tests (these were run, all pass)
npm run typecheck   # NOT run: needs deps installed
npx expo-doctor     # NOT run
```

## Requirement status

| # | Requirement | Mobile | Backend |
|---|---|---|---|
| 1 | Rate limits (analyze / lesson / chat), per-user daily quotas, no re-analysis unless `force=true`, global Gemini concurrency cap | n/a (429 already maps to a retryable error) | **Not done (no code)** |
| 2 | JWT secret guard in every env except development/testing | n/a | **Not done (no code)** |
| 3 | Reject oversized early, dimension validation, resize before Gemini, error codes | **Done**: on-device resize (long edge 1600), dimension/byte validation, one 413 recovery retry, correct error-code table | **Not done** (server resize, early reject, codes) |
| 4 | GPS accuracy, stale rejection, accuracy metadata, approximate warnings | **Done** (validate, reject, warn, store locally) | Not done (accept/validate `location_source`, `fixed_at`; return `warnings`) |
| 5 | Job status, duplicate-run prevention, cancellation | **Done** (single-flight job registry, abort signals, confirm-on-back, no hijack) | Not done (server job status; server-side cancel) |

## Backend contract to implement next (needs the backend source)

1. **Rate limiting / quotas**: per-IP limits on `/auth/*`; per-user limits and daily quotas on analyze,
   learning-experience (incl. `regenerate=true`), chat and uploads. Respond `429` with `Retry-After` and
   `details.retry_after_seconds` (the mobile client already reads both). Distinct code for a daily quota
   (e.g. `daily_quota_exceeded`) vs a burst limit (`rate_limited`).
2. **Analyze idempotency**: if the observation is already `complete`, return the stored analysis; re-run only with `?force=true`
   (itself quota-counted). The mobile pipeline already skips analyze when status is `complete`.
3. **Global Gemini cap**: a semaphore around every Gemini call; when saturated return 503/429 with `Retry-After`
   rather than queueing threads.
4. **JWT guard**: refuse to start when `environment` is not in `{development, testing}` and the secret is the
   default / empty / shorter than 32 chars.
5. **Uploads**: enforce `Content-Length` before reading the body (413 `photo_too_large`); decode with Pillow,
   cap pixel count, reject undecodable (400/422 `photo_invalid`); downscale to ~1600 px long edge
   (copy, re-encoded) before sending to Gemini; strip EXIF from the Gemini copy.
   Keep existing codes `photo_too_large`, `unsupported_photo_type`.
6. **Location**: accept optional `location_source` (`current|last_known`) and `fixed_at`; reject
   `location_accuracy_m` above a ceiling (suggest 1000) and a `fixed_at` older than a few minutes or in the
   future; include `warnings: ["approximate_location"]` in the response when accuracy is poor. Mobile currently
   sends only `location_accuracy_m`; the new draft fields are stored on-device and are not sent yet.
7. **Job status / cancel**: `GET /observations/{id}/status` already exists; add `analysis_started_at`; a
   cancel endpoint is only useful if the Gemini call can be aborted. Otherwise client-side abort plus the
   atomic claim (already present) is sufficient.

Required backend tests: burst vs daily 429s, `Retry-After` presence, re-analysis returns stored result,
`force=true` counted, semaphore saturation, JWT guard per environment (incl. staging), oversized
`Content-Length`, decompression-bomb image, truncated JPEG, accuracy/stale rejection, warnings in response,
OpenAPI snapshot containing the new params/codes.

## Known limits of the mobile changes

- Aborting the analyze request cannot stop Gemini on the server; the analysis may still complete and be billed.
  Resuming reuses it (status check, then `analysis_in_progress` wait), so it is never run twice.
- Aborting an upload whose response was lost can leave an unlinked observation on the server (pre-existing behaviour on any network failure).
- `expo-image-manipulator` was added as `~56.0.0` by pattern; confirm with `npx expo install`. The
  contextual API (`ImageManipulator.manipulate(...).renderAsync()/saveAsync()`) is used.
- Draft DB migration v2 adds `location_source` and `fixed_at` columns (ALTER TABLE, additive).
