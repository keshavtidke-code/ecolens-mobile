/**
 * Draft photo persistence – SDK 56 compatible.
 *
 * Uses expo-file-system/legacy so that URL-encoded Expo Go cache URIs
 * (e.g. %40anonymous%2Fecolens in the ImageManipulator path) are handled
 * natively without any decoding magic.
 */
import * as FileSystem from "expo-file-system/legacy";

const DRAFTS_DIR = `${FileSystem.documentDirectory}drafts/`;

async function ensureDraftsDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DRAFTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAFTS_DIR, { intermediates: true });
  }
}

/**
 * Copies the camera temp photo into permanent app storage.
 * Returns a stable file:// URI that survives screen transitions and app restarts.
 * Throws a user-visible Error when the source is missing or the copy fails.
 */
export async function persistDraftPhoto(sourceUri: string): Promise<string> {
  // Ensure a file:// prefix – legacy FileSystem requires it.
  const uri = sourceUri.startsWith("file://") || sourceUri.startsWith("content://")
    ? sourceUri
    : "file://" + sourceUri;

  console.log("[draftFiles] persistDraftPhoto uri:", uri);

  const srcInfo = await FileSystem.getInfoAsync(uri);
  console.log("[draftFiles] src exists:", srcInfo.exists);

  if (!srcInfo.exists) {
    throw new Error(
      "The photo file is missing from the camera (" + uri + "). Please retake the photo.",
    );
  }
  if ("size" in srcInfo && (srcInfo.size ?? 0) < 1) {
    throw new Error("The photo file is empty. Please retake the photo.");
  }

  await ensureDraftsDir();

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destUri = `${DRAFTS_DIR}${filename}`;

  await FileSystem.copyAsync({ from: uri, to: destUri });

  const destInfo = await FileSystem.getInfoAsync(destUri);
  console.log("[draftFiles] dest exists:", destInfo.exists);

  if (!destInfo.exists) {
    throw new Error(
      "Couldn't save the photo to device storage. Please check your free space and try again.",
    );
  }

  return destUri;
}

export async function draftPhotoExists(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export function deleteDraftPhoto(uri: string): void {
  // Fire-and-forget – deletion failure is non-fatal.
  FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { /* already gone */ });
}
