const fs = require("fs"), vm = require("vm");
const V8 = "/Users/malikpeace/myth-of-sisyphus-live/v8/";
const ctx = { console, Math }; ctx.window = ctx; ctx.root = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(V8 + "px.js", "utf8"), ctx); vm.runInContext(fs.readFileSync(V8 + "hero.js", "utf8"), ctx);
const Hero = ctx.Hero, ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function P(alt, slope, wp) {
  const s0 = 1.32, s = s0 * 1.14, theta = Math.atan(slope), scl = 0.62 + (2.85 - 0.62) * ss(alt / 1200), brad = Math.round(32 * s0 * scl);
  const growT = Math.max(0, Math.min(1, (scl - 1) / (2.85 - 1))), bly = -brad + 2 * s0, blx = Math.round((19 - 11 * growT) * s0) + brad;
  return { s, brace: 0, stumble: 0, pushDrive: 0, windLean: 0, wp, activity: 1, effort: 0.9, slideEffort: 0, tSec: 1, reduced: false, playing: true, groove: 0, theta, ratio: brad / (32 * s0), brad, blx, bly, manBaseX: 0 };
}
const alt = +process.argv[2] || 0, slope = +process.argv[3] || 0.03;
for (let i = 0; i < 8; i++) {
  const wp = i / 8, p = P(alt, slope, wp), J = Hero.rig(p), s = p.s;
  const f = (q) => "(" + (q.x / s).toFixed(1) + "," + (q.y / s).toFixed(1) + ")";
  const legs = J.legs.map((l, k) => { const cross = (l.knee.x - J.hip.x) * (l.foot.y - J.hip.y) - (l.knee.y - J.hip.y) * (l.foot.x - J.hip.x); return (l.far ? "far" : "near") + " foot" + f(l.foot) + " knee" + f(l.knee) + " kneeSide=" + (cross > 0 ? "BACK?" : "front?") + (l.plant ? " plant" : " lift"); });
  console.log("wp", wp.toFixed(3), "hip", f(J.hip), legs.join(" | "));
}
