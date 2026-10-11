import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePosition, isFixStillFresh, LOCATION_POLICY } from "./locationPolicy.ts";

const NOW = 1_800_000_000_000;
const pos = (over: Partial<{ latitude: number; longitude: number; accuracy: number | null; timestamp: number }> = {}) => ({
  latitude: 16.705,
  longitude: 74.2433,
  accuracy: 12,
  timestamp: NOW - 5_000,
  ...over,
});

describe("evaluatePosition", () => {
  it("accepts a fresh precise fix with no warning", () => {
    const v = evaluatePosition(pos(), "current", NOW);
    assert.equal(v.ok, true);
    if (v.ok) {
      assert.equal(v.fix.quality, "precise");
      assert.equal(v.fix.warning, null);
      assert.equal(v.fix.accuracyM, 12);
      assert.equal(v.fix.source, "current");
      assert.equal(v.fix.fixedAt, new Date(NOW - 5_000).toISOString());
      assert.equal(v.fix.ageMs, 5_000);
      assert.equal(v.fix.obtainedAtMs, NOW);
    }
  });

  it("flags accuracy above the precise threshold as approximate with a warning", () => {
    const v = evaluatePosition(pos({ accuracy: 350 }), "current", NOW);
    assert.equal(v.ok, true);
    if (v.ok) {
      assert.equal(v.fix.quality, "approximate");
      assert.match(v.fix.warning ?? "", /±350 m/);
    }
  });

  it("treats accuracy exactly at the precise threshold as precise", () => {
    const v = evaluatePosition(pos({ accuracy: LOCATION_POLICY.preciseAccuracyM }), "current", NOW);
    assert.equal(v.ok && v.fix.quality, "precise");
  });

  it("accepts accuracy exactly at the reject threshold but rejects above it", () => {
    assert.equal(evaluatePosition(pos({ accuracy: 1000 }), "current", NOW).ok, true);
    const bad = evaluatePosition(pos({ accuracy: 1001 }), "current", NOW);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.reason, "inaccurate");
  });

  it("accepts a current fix with unknown accuracy but marks it approximate", () => {
    for (const accuracy of [null, undefined, Number.NaN, -1]) {
      const v = evaluatePosition(pos({ accuracy: accuracy as number | null }), "current", NOW);
      assert.equal(v.ok, true);
      if (v.ok) {
        assert.equal(v.fix.accuracyM, null);
        assert.equal(v.fix.quality, "approximate");
        assert.ok(v.fix.warning);
      }
    }
  });

  it("rejects a stale current fix, and accepts it exactly at the age limit", () => {
    const atLimit = evaluatePosition(pos({ timestamp: NOW - LOCATION_POLICY.currentMaxAgeMs }), "current", NOW);
    assert.equal(atLimit.ok, true);
    const stale = evaluatePosition(pos({ timestamp: NOW - LOCATION_POLICY.currentMaxAgeMs - 1 }), "current", NOW);
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.reason, "stale");
  });

  it("rejects a last-known fix from another city hours ago", () => {
    const v = evaluatePosition(pos({ timestamp: NOW - 3 * 3600_000 }), "last_known", NOW);
    assert.equal(v.ok, false);
    if (!v.ok) {
      assert.equal(v.reason, "stale");
      assert.match(v.message, /180 min/);
    }
  });

  it("accepts a recent accurate last-known fix, always with an approximate warning", () => {
    const v = evaluatePosition(pos({ accuracy: 30, timestamp: NOW - 4 * 60_000 }), "last_known", NOW);
    assert.equal(v.ok, true);
    if (v.ok) {
      assert.equal(v.fix.source, "last_known");
      assert.equal(v.fix.quality, "approximate");
      assert.match(v.fix.warning ?? "", /last known location/);
    }
  });

  it("rejects last-known fixes with unknown or poor accuracy", () => {
    for (const accuracy of [null, 501, 900]) {
      const v = evaluatePosition(pos({ accuracy }), "last_known", NOW);
      assert.equal(v.ok, false, `accuracy ${accuracy}`);
      if (!v.ok) assert.equal(v.reason, "inaccurate");
    }
  });

  it("uses the longer age window for last-known fixes", () => {
    const v = evaluatePosition(pos({ timestamp: NOW - 4 * 60_000 }), "current", NOW);
    assert.equal(v.ok, false); // 4 min is stale for a "current" fix...
    const ok = evaluatePosition(pos({ timestamp: NOW - 4 * 60_000 }), "last_known", NOW);
    assert.equal(ok.ok, true); // ...but fine for the fallback.
  });

  it("rejects invalid coordinates", () => {
    const cases = [
      { latitude: Number.NaN },
      { longitude: Number.POSITIVE_INFINITY },
      { latitude: 91 },
      { latitude: -90.1 },
      { longitude: 180.5 },
      { latitude: 0, longitude: 0 },
    ];
    for (const over of cases) {
      const v = evaluatePosition(pos(over), "current", NOW);
      assert.equal(v.ok, false, JSON.stringify(over));
      if (!v.ok) assert.equal(v.reason, "invalid");
    }
  });

  it("accepts the equator and the antimeridian (only exactly 0,0 is a placeholder)", () => {
    assert.equal(evaluatePosition(pos({ latitude: 0, longitude: 10 }), "current", NOW).ok, true);
    assert.equal(evaluatePosition(pos({ latitude: -90, longitude: 180 }), "current", NOW).ok, true);
  });

  it("rejects a non-finite timestamp and a timestamp far in the future", () => {
    assert.equal(evaluatePosition(pos({ timestamp: Number.NaN }), "current", NOW).ok, false);
    const future = evaluatePosition(pos({ timestamp: NOW + LOCATION_POLICY.futureSkewMs + 1 }), "current", NOW);
    assert.equal(future.ok, false);
    if (!future.ok) assert.equal(future.reason, "invalid");
  });

  it("tolerates small clock skew by clamping the age to zero", () => {
    const v = evaluatePosition(pos({ timestamp: NOW + 5_000 }), "current", NOW);
    assert.equal(v.ok && v.fix.ageMs, 0);
  });
});

describe("isFixStillFresh", () => {
  it("is true within the recheck window and false after it", () => {
    assert.equal(isFixStillFresh({ obtainedAtMs: NOW }, NOW + LOCATION_POLICY.saveRecheckMs), true);
    assert.equal(isFixStillFresh({ obtainedAtMs: NOW }, NOW + LOCATION_POLICY.saveRecheckMs + 1), false);
  });
});
