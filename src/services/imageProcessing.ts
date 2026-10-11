import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image } from "react-native";
import { ApiError } from "@/api";
import { IMAGE_POLICY, needsProcessing, planResize, validateBytes, validateDimensions } from "./imagePolicy";
import type { PhotoVerdict } from "./imagePolicy";

export interface PreparedPhoto {
  uri: string;
  width: number;
  height: number;
  bytes: number;
  /** True when the photo was re-encoded (so `uri` differs from the input). */
  processed: boolean;
}

function fail(verdict: Extract<PhotoVerdict, { ok: false }>): never {
  throw new ApiError({ message: verdict.message, code: verdict.code });
}

function fileBytes(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function reencode(
  uri: string,
  size: { width: number; height: number },
  maxLongEdge: number,
  quality: number,
): Promise<{ uri: string; width: number; height: number }> {
  const plan = planResize(size.width, size.height, maxLongEdge);
  const context = ImageManipulator.manipulate(uri);
  if (plan.resize) context.resize(size.width >= size.height ? { width: plan.width } : { height: plan.height });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Validates a photo and, if it is too big (pixels or bytes), re-encodes it as JPEG with a bounded long edge.
 * Throws ApiError (code photo_empty | photo_invalid_dimensions | photo_too_large) when it can't be made uploadable.
 */
export async function prepareUploadPhoto(uri: string, knownSize?: { width: number; height: number }): Promise<PreparedPhoto> {
  const sourceBytes = fileBytes(uri);
  if (sourceBytes === 0) fail({ ok: false, code: "photo_empty", message: "That photo file is empty. Please take it again." });

  const size = knownSize ?? (await imageSize(uri).catch(() => ({ width: 0, height: 0 })));
  const dimensions = validateDimensions(size.width, size.height);
  if (!dimensions.ok) fail(dimensions);

  if (!needsProcessing(size.width, size.height, sourceBytes)) {
    return { uri, width: size.width, height: size.height, bytes: sourceBytes, processed: false };
  }

  let out = await reencode(uri, size, IMAGE_POLICY.maxLongEdgePx, IMAGE_POLICY.jpegQuality);
  let bytes = fileBytes(out.uri);
  if (bytes > IMAGE_POLICY.targetMaxBytes) {
    out = await reencode(uri, size, IMAGE_POLICY.fallbackLongEdgePx, IMAGE_POLICY.fallbackQuality);
    bytes = fileBytes(out.uri);
  }
  const verdict = validateBytes(bytes);
  if (!verdict.ok) fail(verdict);
  return { uri: out.uri, width: out.width, height: out.height, bytes, processed: true };
}

/** Last-resort shrink used once after the server answers 413 / photo_too_large. */
export async function shrinkPhoto(uri: string): Promise<PreparedPhoto> {
  const size = await imageSize(uri).catch(() => ({ width: 0, height: 0 }));
  const dimensions = validateDimensions(size.width, size.height);
  if (!dimensions.ok) fail(dimensions);
  const out = await reencode(uri, size, IMAGE_POLICY.fallbackLongEdgePx, IMAGE_POLICY.fallbackQuality);
  const bytes = fileBytes(out.uri);
  const verdict = validateBytes(bytes);
  if (!verdict.ok) fail(verdict);
  return { uri: out.uri, width: out.width, height: out.height, bytes, processed: true };
}
