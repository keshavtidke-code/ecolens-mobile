import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRIENDLY, statusFallbackMessage } from "./errorMessages.ts";

describe("error messages", () => {
  it("maps the codes the backend really emits for uploads", () => {
    assert.match(FRIENDLY.photo_too_large ?? "", /too large/);
    assert.match(FRIENDLY.unsupported_photo_type ?? "", /isn't supported/);
  });

  it("still maps the legacy keys", () => {
    assert.equal(FRIENDLY.payload_too_large, FRIENDLY.photo_too_large);
    assert.equal(FRIENDLY.unsupported_media_type, FRIENDLY.unsupported_photo_type);
  });

  it("has messages for every on-device photo rejection and for cancellation", () => {
    for (const code of ["photo_invalid_dimensions", "photo_empty", "cancelled"]) {
      assert.ok(FRIENDLY[code], code);
    }
  });

  it("falls back by HTTP status when no code/message is available", () => {
    assert.match(statusFallbackMessage(413), /too large/);
    assert.match(statusFallbackMessage(415), /isn't supported/);
    assert.match(statusFallbackMessage(500), /HTTP 500/);
  });
});
