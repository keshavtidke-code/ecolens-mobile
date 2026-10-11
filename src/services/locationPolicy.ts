/**
 * Pure rules deciding whether a GPS position is good enough to attach to an observation.
 * No React Native imports on purpose: this file is unit-tested under plain Node.
 */

export const LOCATION_POLICY = {
  /** A fresh fix older than this is treated as stale. */
  currentMaxAgeMs: 2 * 60_000,
  /** Cached ("last known") fixes are only a fallback, so they get a stricter accuracy bar but a longer age window. */
  lastKnownMaxAgeMs: 5 * 60_000,
  lastKnownMaxAccuracyM: 500,
  /** At or below this the fix is "precise"; above it the user is warned the place/weather may be off. */
  preciseAccuracyM: 100,
  /** Above this the fix is unusable (coarse network/cell location). */
  rejectAccuracyM: 5_000,
  /** Tolerated clock skew between the device clock and the position timestamp. */
  futureSkewMs: 60_000,
  /** The review screen re-locates if the user sat on a fix for longer than this before saving. */
  saveRecheckMs: 10 * 60_000,
} as const;

export type FixSource = "current" | "last_known";
export type FixQuality = "precise" | "approximate";
export type FixRejection = "invalid" | "stale" | "inaccurate";

export interface RawPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null | undefined;
  /** Epoch milliseconds, as reported by the OS. */
  timestamp: number;
}

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  source: FixSource;
  /** When the OS says the position was measured (ISO 8601). Stored with the draft as accuracy metadata. */
  fixedAt: string;
  /** Age of the position when it was accepted. */
  ageMs: number;
  /** Epoch ms when this app accepted the fix (used to decide whether to re-locate before saving). */
  obtainedAtMs: number;
  quality: FixQuality;
  /** User-presentable caveat, or null when the fix is precise and fresh. */
  warning: string | null;
}

export type FixVerdict =
  | { ok: true; fix: GpsFix }
  | { ok: false; reason: FixRejection; message: string };

function formatAge(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}

function validCoordinates(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  // Exactly (0, 0) is the classic "no fix" placeholder, not a real observation site.
  if (lat === 0 && lon === 0) return false;
  return true;
}

export function evaluatePosition(raw: RawPosition, source: FixSource, now: number = Date.now()): FixVerdict {
  if (!validCoordinates(raw.latitude, raw.longitude) || !Number.isFinite(raw.timestamp)) {
    return { ok: false, reason: "invalid", message: "The device returned an invalid location. Please try again." };
  }

  const rawAge = now - raw.timestamp;
  if (rawAge < -LOCATION_POLICY.futureSkewMs) {
    return { ok: false, reason: "invalid", message: "Your device clock looks wrong, so the location can't be trusted. Check the date and time." };
  }
  const ageMs = Math.max(0, rawAge);
  const maxAge = source === "current" ? LOCATION_POLICY.currentMaxAgeMs : LOCATION_POLICY.lastKnownMaxAgeMs;
  if (ageMs > maxAge) {
    return {
      ok: false,
      reason: "stale",
      message: `Your last location is ${formatAge(ageMs)} old, which is too old to use. Move to an open area and try again.`,
    };
  }

  const accuracyM =
    typeof raw.accuracy === "number" && Number.isFinite(raw.accuracy) && raw.accuracy >= 0 ? raw.accuracy : null;

  if (source === "last_known") {
    if (accuracyM === null || accuracyM > LOCATION_POLICY.lastKnownMaxAccuracyM) {
      return {
        ok: false,
        reason: "inaccurate",
        message: "Couldn't get a precise enough location. Move to an open area and try again.",
      };
    }
  }
  if (accuracyM !== null && accuracyM > LOCATION_POLICY.rejectAccuracyM) {
    return {
      ok: false,
      reason: "inaccurate",
      message: `The GPS signal is too weak (Â±${Math.round(accuracyM)} m). Move to an open area and try again.`,
    };
  }

  let quality: FixQuality = "precise";
  let warning: string | null = null;
  if (source === "last_known") {
    quality = "approximate";
    warning = `Using your last known location from ${formatAge(ageMs)} ago. Place and weather may be slightly off.`;
  } else if (accuracyM === null) {
    quality = "approximate";
    warning = "The device didn't report how accurate this location is. Place and weather may be slightly off.";
  } else if (accuracyM > LOCATION_POLICY.preciseAccuracyM) {
    quality = "approximate";
    warning = `Location is approximate (Â±${Math.round(accuracyM)} m). Place and weather may be slightly off.`;
  }

  return {
    ok: true,
    fix: {
      latitude: raw.latitude,
      longitude: raw.longitude,
      accuracyM,
      source,
      fixedAt: new Date(raw.timestamp).toISOString(),
      ageMs,
      obtainedAtMs: now,
      quality,
      warning,
    },
  };
}

/** False once the user has sat on a fix long enough that they may have moved. */
export function isFixStillFresh(fix: Pick<GpsFix, "obtainedAtMs">, now: number = Date.now()): boolean {
  return now - fix.obtainedAtMs <= LOCATION_POLICY.saveRecheckMs;
}
