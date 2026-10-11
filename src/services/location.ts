import * as Location from "expo-location";
import { evaluatePosition, LOCATION_POLICY } from "./locationPolicy";
import type { FixVerdict, GpsFix, RawPosition } from "./locationPolicy";

export type { GpsFix } from "./locationPolicy";

export type LocationErrorCode =
  | "permission_denied"
  | "services_disabled"
  | "unavailable"
  | "stale_location"
  | "inaccurate_location";

export class LocationError extends Error {
  constructor(
    readonly code: LocationErrorCode,
    message: string,
    readonly canAskAgain = true,
  ) {
    super(message);
    this.name = "LocationError";
  }
}

const FIX_TIMEOUT_MS = 20_000; // Reduced – we now try last-known first

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new LocationError("unavailable", "Getting your location took too long.")),
      ms,
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function toRaw(position: Location.LocationObject): RawPosition {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

function rejectionToError(verdict: Extract<FixVerdict, { ok: false }>): LocationError {
  const code: LocationErrorCode =
    verdict.reason === "stale"
      ? "stale_location"
      : verdict.reason === "inaccurate"
        ? "inaccurate_location"
        : "unavailable";
  return new LocationError(code, verdict.message);
}

/**
 * DEV-only Baramti, India fallback.
 * Used when BOTH getCurrentPositionAsync AND getLastKnownPositionAsync fail on the
 * Android emulator (which has no real GPS chip and no cached network location).
 */
function devFallbackFix(): GpsFix {
  console.warn("[location] Using DEV fallback location: Baramti, India");
  return {
    latitude: 18.1489,
    longitude: 74.58,
    accuracyM: 50,
    source: "current",
    fixedAt: new Date().toISOString(),
    ageMs: 0,
    obtainedAtMs: Date.now(),
    quality: "approximate",
    warning: "⚠️ Dev fallback location (Baramti, India) — GPS unavailable on this emulator.",
  };
}

/**
 * Foreground GPS fix. Strategy:
 * 1. Try getLastKnownPositionAsync (instant — picks up adb emu geo fix).
 * 2. Fall back to getCurrentPositionAsync (20s timeout, Balanced accuracy).
 * 3. In __DEV__ mode, fall back to hardcoded Baramti so the emulator always works.
 * Throws LocationError with a user-presentable message on permanent failure.
 */
export async function getCurrentFix(): Promise<GpsFix> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new LocationError(
      "permission_denied",
      "EcoLens needs your location to look up the place and weather for this photo.",
      permission.canAskAgain,
    );
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationError(
      "services_disabled",
      "Location services are turned off. Turn them on and try again.",
    );
  }

  // --- Step 1: Last-known (instant, no battery cost) ---
  // Works immediately on emulator when adb emu geo fix was used.
  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: LOCATION_POLICY.lastKnownMaxAgeMs,
      requiredAccuracy: LOCATION_POLICY.rejectAccuracyM, // generous — just needs to be on Earth
    });
    if (last) {
      const verdict = evaluatePosition(toRaw(last), "last_known");
      if (verdict.ok) {
        console.log("[location] Using last-known fix:", verdict.fix.latitude, verdict.fix.longitude);
        return verdict.fix;
      }
    }
  } catch {
    // not fatal — fall through to live fix
  }

  // --- Step 2: Live fix (Balanced accuracy, 20s timeout) ---
  let liveError: unknown = null;
  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      FIX_TIMEOUT_MS,
    );
    const verdict = evaluatePosition(toRaw(current), "current");
    if (verdict.ok) return verdict.fix;
    throw rejectionToError(verdict);
  } catch (e) {
    liveError = e;
    console.warn("[location] Live fix failed:", e instanceof Error ? e.message : e);
  }

  // --- Step 3: DEV fallback ---
  if (__DEV__) return devFallbackFix();

  // Production: surface the real error
  if (liveError instanceof LocationError) throw liveError;
  throw new LocationError("unavailable", "Couldn't determine your location. Move to an open area and try again.");
}
