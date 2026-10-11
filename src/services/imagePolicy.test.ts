import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BACKEND_MAX_UPLOAD_BYTES,
  IMAGE_POLICY,
  needsProcessing,
  planResize,
  validateBytes,
  validateDimensions,
} from "./imagePolicy.ts";

describe("planResize", () => {
  it("shrinks a 50 MP landscape photo so the long edge is 1600 px, preserving aspect ratio", () => {
    const plan = planResize(8160, 6120);
    assert.deepEqual(plan, { resize: true, width: 1600, height: 1200 });
  });

  it("shrinks portrait photos by the long (height) edge", () => {
    assert.deepEqual(planResize(3000, 4000), { resize: true, width: 1200, height: 1600 });
  });

  it("never upscales and leaves images at or under the limit alone", () => {
    assert.deepEqual(planResize(1600, 900), { resize: false, width: 1600, height: 900 });
    assert.deepEqual(planResize(800, 600), { resize: false, width: 800, height: 600 });
  });

  it("honours a custom (fallback) long edge", () => {
    assert.deepEqual(planResize(1600, 1200, IMAGE_POLICY.fallbackLongEdgePx), { resize: true, width: 1280, height: 960 });
  });

  it("never produces a zero-sized edge", () => {
    const plan = planResize(100_000, 10);
    assert.equal(plan.height >= 1, true);
  });
});

describe("validateDimensions", () => {
  it("accepts ordinary photos", () => {
    assert.equal(validateDimensions(4032, 3024).ok, true);
    assert.equal(validateDimensions(64, 64).ok, true);
  });

  it("rejects zero, negative, NaN and non-finite sizes", () => {
    for (const [w, h] of [[0, 100], [100, 0], [-5, 100], [Number.NaN, 100], [100, Number.POSITIVE_INFINITY]]) {
      const v = validateDimensions(w, h);
      assert.equal(v.ok, false, `${w}x${h}`);
      if (!v.ok) assert.equal(v.code, "photo_invalid_dimensions");
    }
  });

  it("rejects images below the minimum edge", () => {
    assert.equal(validateDimensions(63, 500).ok, false);
  });

  it("rejects extreme aspect ratios but accepts exactly the limit", () => {
    assert.equal(validateDimensions(1000, 100).ok, true);
    assert.equal(validateDimensions(1001, 100).ok, false);
  });

  it("rejects sources with an absurd pixel count", () => {
    assert.equal(validateDimensions(20_000, 15_000).ok, false); // 300 MP
    assert.equal(validateDimensions(14_000, 14_000).ok, true); // 196 MP
  });
});

describe("validateBytes", () => {
  it("accepts sizes up to and including the backend limit", () => {
    assert.equal(validateBytes(1).ok, true);
    assert.equal(validateBytes(BACKEND_MAX_UPLOAD_BYTES).ok, true);
  });

  it("rejects an empty file with photo_empty", () => {
    const v = validateBytes(0);
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "photo_empty");
  });

  it("rejects one byte over the limit with photo_too_large", () => {
    const v = validateBytes(BACKEND_MAX_UPLOAD_BYTES + 1);
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.code, "photo_too_large");
  });

  it("keeps the client budget strictly under the backend limit", () => {
    assert.ok(IMAGE_POLICY.targetMaxBytes < BACKEND_MAX_UPLOAD_BYTES);
  });
});

describe("needsProcessing", () => {
  it("is true for oversize dimensions or bytes, false otherwise", () => {
    assert.equal(needsProcessing(4000, 3000, 500_000), true);
    assert.equal(needsProcessing(1600, 1200, IMAGE_POLICY.targetMaxBytes + 1), true);
    assert.equal(needsProcessing(1600, 1200, IMAGE_POLICY.targetMaxBytes), false);
    assert.equal(needsProcessing(1280, 960, 300_000), false);
  });
});
