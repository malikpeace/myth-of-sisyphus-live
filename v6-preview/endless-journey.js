(function (root) {
  "use strict";
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function smooth(value) { var t = clamp(value, 0, 1); return t * t * (3 - 2 * t); }
  function profile(height) {
    var intensity = smooth((Math.max(0, height) - 180) / 2300);
    return {
      intensity: intensity,
      decay: clamp(1.28 + intensity * 0.42, 1.28, 1.70),
      slip: 0.74 + intensity * 0.32,
      grace: clamp(1.65 - intensity * 0.65, 1, 1.65),
      fallSpeed: 12 + intensity * 48,
      fallDistance: 10 + intensity * 130,
      hazard: smooth((height - 250) / 1400)
    };
  }
  function fallFloor(start) {
    return Math.max(0, start - Math.min(start * 0.35, profile(start).fallDistance));
  }
  function approach(value, target, rate, dt) {
    return value + (target - value) * (1 - Math.exp(-rate * Math.max(0, dt)));
  }
  function decode(raw) {
    try {
      var data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || data.version !== 1 || !Number.isFinite(data.altitude) || data.altitude < 0 || data.altitude > 1e7) return null;
      var result = { version: 1, altitude: data.altitude };
      var limits = {
        peak: [data.altitude, 1e7], roll: [-1e9, 1e9], gait: [-1e9, 1e9],
        energy: [0, 1], resolve: [0, 1], snow: [0, 1], elapsed: [0, 31536000],
        baseline: [0, 1e7], biggestFall: [0, 1e7], falls: [0, 1e6], milestones: [0, 1e6]
      };
      Object.keys(limits).forEach(function (key) {
        var value = Number.isFinite(data[key]) ? data[key] : (key === "energy" ? 1 : limits[key][0]);
        result[key] = clamp(value, limits[key][0], limits[key][1]);
      });
      result.baseline = Math.min(result.baseline, result.peak);
      result.recorded = data.recorded === true;
      return result;
    } catch (_) { return null; }
  }
  var api = { profile: profile, fallFloor: fallFloor, approach: approach, decode: decode };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SisyphusJourney = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
