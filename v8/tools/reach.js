// usage: node reach.js [tune-json]
const fs = require("fs"), vm = require("vm");
const V8 = "/Users/malikpeace/myth-of-sisyphus-live/v8/";
const ctx = { console, Math }; ctx.window = ctx; ctx.root = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(V8 + "px.js", "utf8"), ctx);
if (process.argv[2]) ctx.HERO_TUNE = JSON.parse(process.argv[2]);
vm.runInContext(fs.readFileSync(V8 + "hero.js", "utf8"), ctx);
const Hero = ctx.Hero;
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function P(alt, slope, wp) {
  const s0 = 1.32, s = s0 * 1.14, theta = Math.atan(slope), scl = 0.62 + (2.85 - 0.62) * ss(alt / 1200), brad = Math.round(32 * s0 * scl);
  const growT = Math.max(0, Math.min(1, (scl - 1) / (2.85 - 1))), bly = -brad + 2 * s0, blx = Math.round((19 - 11 * growT) * s0) + brad;
  return { s, brace: 0, stumble: 0, pushDrive: 0, windLean: 0, wp, activity: 1, effort: 0.9, slideEffort: 0, tSec: 1, reduced: false, playing: true, groove: 0, theta, ratio: brad / (32 * s0), brad, blx, bly, manBaseX: 0 };
}
const arm = (8.2 + 7.8);
for (const alt of [0, 200, 400, 700, 1000, 1400, 2000]) {
  const p = P(alt, alt < 100 ? 0.03 : 0.5, 0.3), J = Hero.rig(p), s = p.s;
  const dh = Math.hypot(J.hand.x - J.sh.x, J.hand.y - J.sh.y) / s, de = Math.hypot(J.elbow.x - J.sh.x, J.elbow.y - J.sh.y) / s;
  const ang = Math.atan2(-(J.hand.y - J.sh.y), J.hand.x - J.sh.x) * 57.3;
  console.log("alt", alt, "ratio", p.ratio.toFixed(2), "| sh", (J.sh.x / s).toFixed(1), (J.sh.y / s).toFixed(1), "hand", (J.hand.x / s).toFixed(1), (J.hand.y / s).toFixed(1),
    "| reach", dh.toFixed(1), "/", arm, "handAng", ang.toFixed(0), "| lean", (J.lean * 57.3).toFixed(0), "screenlean", ((J.lean - p.theta) * 57.3).toFixed(0), "| head", (J.head.x / s).toFixed(1), (J.head.y / s).toFixed(1), "hipx", (J.hip.x / s).toFixed(1), "leanIn", (J.leanIn / s).toFixed(1));
}
