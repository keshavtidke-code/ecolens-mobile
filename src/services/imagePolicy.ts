/**
 * Pure rules for photo size/dimensions before upload. No React Native imports: unit-tested under plain Node.
 */

/** Must stay in sync with the backend's upload limit. The client targets a smaller budget so it never hits it. */
export const BACKEND_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_POLICY = {
  maxLongEdgePx: 1600,
  /** Used for the single retry after the server answers "too large". */
  fallbackLongEdgePx: 1280,
  jpegQuality: 0.8,
  fallbackQuality: 0.6,
  /** Client-side budget, comfortably under the backend limit. */
  targetMaxBytes: 8 * 1024 * 1024,
  minEdgePx: 64,
  /** Panoramas/strips this extreme are almost certainly not an ecosystem photo and cost decode memory. */
  maxAspectRatio: 10,
  /** Refuse to decode absurdly large sources on-device. */
  maxSourcePixels: 200_000_000,
} as const;

export type PhotoRejection = "photo_invalid_dimensions" | "photo_empty" | "photo_too_large";

export type PhotoVerdict = { ok: true } | { ok: false; code: PhotoRejection; message: string };

export function validateDimensions(width: number, height: number): PhotoVerdict {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { ok: false, code: "photo_invalid_dimensions", message: "That photo couldn't be read. Please take it again." };
  }
  if (Math.min(width, height) < IMAGE_POLICY.minEdgePx) {
    return { ok: false, code: "photo_invalid_dimensions", message: "That photo is too small to analyze. Please take a new one." };
  }
  if (Math.max(width, height) / Math.min(width, height) > IMAGE_POLICY.maxAspectRatio) {
    return { ok: false, code: "photo_invalid_dimensions", message: "That photo's shape isn't supported. Please take a regular photo." };
  }
  if (width * height > IMAGE_POLICY.maxSourcePixels) {
    return { ok: false, code: "photo_invalid_dimensions", message: "That photo is too large to process on this device." };
  }
  return { ok: true };
}

export function validateBytes(bytes: number, limit: number = BACKEND_MAX_UPLOAD_BYTES): PhotoVerdict {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, code: "photo_empty", message: "That photo file is empty. Please take it again." };
  }
  if (bytes > limit) {
    return { ok: false, code: "photo_too_large", message: "That photo is too large to upload, even after shrinking it." };
  }
  return { ok: true };
}

export interface ResizePlan {
  resize: boolean;
  width: number;
  height: number;
}

/** Fits the image inside a maxLongEdge x maxLongEdge box without upscaling or changing aspect ratio. */
export function planResize(width: number, height: number, maxLongEdge: number = IMAGE_POLICY.maxLongEdgePx): ResizePlan {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { resize: false, width, height };
  const scale = maxLongEdge / longEdge;
  return {
    resize: true,
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** True when the file should be re-encoded before upload (too many pixels or too many bytes). */
export function needsProcessing(width: number, height: number, bytes: number): boolean {
  return planResize(width, height).resize || bytes > IMAGE_POLICY.targetMaxBytes;
}
