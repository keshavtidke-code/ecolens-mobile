/** User-presentable messages keyed by backend error code. Pure (no imports) so it is unit-tested under plain Node. */
export const FRIENDLY: Record<string, string> = {
  network_error: "Can't reach the EcoLens server. Check your connection and try again.",
  timeout: "The server took too long to respond. Please try again.",
  cancelled: "Cancelled.",
  ai_not_configured: "AI features are not set up on the server yet.",
  analysis_required: "This photo hasn't been analyzed yet.",
  analysis_in_progress: "The analysis is still running. Give it a few seconds.",
  rate_limited: "You're sending messages too quickly. Please wait a moment.",
  ai_provider_timeout: "The AI took too long to answer. Please try again.",
  ai_provider_error: "The AI service had a problem. Please try again.",
  ai_provider_rate_limited: "The AI service is busy. Please try again shortly.",
  ai_invalid_output: "The AI gave an unusable answer. Please try again.",
  chat_blocked: "The AI couldn't answer that. Try rephrasing your question.",
  analysis_blocked: "The AI couldn't analyze this photo.",
  // Codes the backend actually emits for uploads:
  photo_too_large: "That photo is too large to upload.",
  unsupported_photo_type: "That photo format isn't supported.",
  // Legacy keys, kept so older servers still map:
  payload_too_large: "That photo is too large to upload.",
  unsupported_media_type: "That photo format isn't supported.",
  // Raised on-device before upload:
  photo_invalid_dimensions: "That photo can't be used. Please take a new one.",
  photo_empty: "That photo file is empty. Please take it again.",
};

/** Used when the server sent neither a message nor a known code, so a 413 still reads sensibly. */
export function statusFallbackMessage(status: number): string {
  if (status === 413) return FRIENDLY.photo_too_large as string;
  if (status === 415) return FRIENDLY.unsupported_photo_type as string;
  return `Something went wrong (HTTP ${status}).`;
}
