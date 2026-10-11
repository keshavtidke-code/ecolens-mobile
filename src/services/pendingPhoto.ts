/**
 * One-shot in-memory slot for the camera→review URI handoff.
 *
 * expo-router serialises route params as URL query strings and decodes them
 * once on read. This mangles double-encoded Expo Go file:// paths like
 * file:///.../%2540anonymous%252Fecolens... → file:///.../%40anonymous%2F...
 * which then resolve to wrong filesystem paths on Android.
 *
 * By keeping the URI in a module-level variable we skip serialisation entirely
 * and the exact bytes written by FileSystem are the exact bytes read by Image.
 */

let _pendingUri: string | null = null;

export function setPendingPhotoUri(uri: string): void {
  _pendingUri = uri;
}

export function getPendingPhotoUri(): string | null {
  return _pendingUri;
}

export function clearPendingPhotoUri(): void {
  _pendingUri = null;
}
