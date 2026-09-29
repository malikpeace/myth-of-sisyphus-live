/* V8 pixel UI runtime (pairs with v8/ui.css). Runs at DOMContentLoaded, never touches game state.
   - snaps the menu column / dialog widths / logo scale to the game-pixel grid (--px)
   - splits the title into the two-line pixel logo
   - renders realm thumbnails at an integer scale of game pixels (painted art is resampled to the grid)
   - replaces native title="" tooltips with a pixel tooltip (mouse only)
   - exposes PixelUI.drawText(ctx, text, x, y, opts) so canvas text can use the same bitmap font */
/*<GEN:glyphs>*/
var PIXEL_GLYPHS = {"32":[3,0],"33":[2,1,1,1,1,1,1,0,1],"34":[4,3,5,5,0,0,0,0,0],"35":[6,5,10,10,31,10,31,10,10],"36":[6,5,4,15,20,14,5,30,4],"37":[6,5,24,25,2,4,8,19,3],"38":[6,5,12,18,20,8,21,18,13],"39":[2,1,1,1,0,0,0,0,0],"40":[3,2,1,2,2,2,2,2,1],"41":[3,2,2,1,1,1,1,1,2],"42":[4,3,0,5,2,5,0,0,0],"43":[6,5,0,0,4,4,31,4,4],"44":[3,2,0,0,0,0,0,0,1,2,0],"45":[4,3,0,0,0,0,7,0,0],"46":[2,1,0,0,0,0,0,0,1],"47":[4,3,1,1,2,2,2,4,4],"48":[6,5,14,17,17,17,17,17,14],"49":[6,5,4,12,4,4,4,4,14],"50":[6,5,14,17,1,6,8,16,31],"51":[6,5,14,17,1,6,1,17,14],"52":[6,5,2,6,10,18,31,2,2],"53":[6,5,31,16,30,1,1,17,14],"54":[6,5,6,8,16,30,17,17,14],"55":[6,5,31,1,2,4,8,8,8],"56":[6,5,14,17,17,14,17,17,14],"57":[6,5,14,17,17,15,1,2,12],"58":[2,1,0,0,1,0,0,0,1],"59":[3,2,0,0,1,0,0,0,1,2,0],"60":[4,3,0,0,1,2,4,2,1],"61":[5,4,0,0,0,15,0,15,0],"62":[4,3,0,0,4,2,1,2,4],"63":[5,4,6,9,1,2,4,0,4],"64":[6,5,14,17,23,21,22,16,15],"65":[6,5,14,17,17,31,17,17,17],"66":[6,5,30,17,17,30,17,17,30],"67":[6,5,14,17,16,16,16,17,14],"68":[6,5,30,17,17,17,17,17,30],"69":[5,4,15,8,8,14,8,8,15],"70":[5,4,15,8,8,14,8,8,8],"71":[6,5,14,17,16,23,17,17,15],"72":[6,5,17,17,17,31,17,17,17],"73":[4,3,7,2,2,2,2,2,7],"74":[5,4,1,1,1,1,1,9,6],"75":[6,5,17,18,20,24,20,18,17],"76":[5,4,8,8,8,8,8,8,15],"77":[6,5,17,27,21,21,17,17,17],"78":[6,5,17,17,25,21,19,17,17],"79":[6,5,14,17,17,17,17,17,14],"80":[6,5,30,17,17,30,16,16,16],"81":[6,5,14,17,17,17,21,18,13],"82":[6,5,30,17,17,30,20,18,17],"83":[6,5,14,17,16,14,1,17,14],"84":[6,5,31,4,4,4,4,4,4],"85":[6,5,17,17,17,17,17,17,14],"86":[6,5,17,17,17,17,10,10,4],"87":[6,5,17,17,17,21,21,27,17],"88":[6,5,17,17,10,4,10,17,17],"89":[6,5,17,17,10,4,4,4,4],"90":[6,5,31,1,2,4,8,16,31],"91":[3,2,3,2,2,2,2,2,3],"92":[4,3,4,4,2,2,2,1,1],"93":[3,2,3,1,1,1,1,1,3],"94":[4,3,2,5,0,0,0,0,0],"95":[5,4,0,0,0,0,0,0,0,15,0],"96":[3,2,2,1,0,0,0,0,0],"97":[5,4,0,0,6,1,7,9,7],"98":[5,4,8,8,14,9,9,9,14],"99":[5,4,0,0,7,8,8,8,7],"100":[5,4,1,1,7,9,9,9,7],"101":[5,4,0,0,6,9,15,8,7],"102":[4,3,3,4,7,4,4,4,4],"103":[5,4,0,0,7,9,9,9,7,1,14],"104":[5,4,8,8,14,9,9,9,9],"105":[2,1,1,0,1,1,1,1,1],"106":[4,3,1,0,1,1,1,1,1,1,6],"107":[5,4,8,8,9,10,12,10,9],"108":[3,2,2,2,2,2,2,2,1],"109":[6,5,0,0,30,21,21,21,21],"110":[5,4,0,0,14,9,9,9,9],"111":[5,4,0,0,6,9,9,9,6],"112":[5,4,0,0,14,9,9,9,14,8,8],"113":[5,4,0,0,7,9,9,9,7,1,1],"114":[5,4,0,0,11,12,8,8,8],"115":[5,4,0,0,7,8,6,1,14],"116":[4,3,0,4,7,4,4,4,3],"117":[5,4,0,0,9,9,9,9,7],"118":[6,5,0,0,17,17,17,10,4],"119":[6,5,0,0,17,17,21,21,10],"120":[6,5,0,0,17,10,4,10,17],"121":[5,4,0,0,9,9,9,9,7,1,14],"122":[5,4,0,0,15,1,6,8,15],"123":[4,3,3,2,2,4,2,2,3],"124":[2,1,1,1,1,1,1,1,1,1,0],"125":[4,3,6,2,2,1,2,2,6],"126":[6,5,0,0,0,8,21,2,0],"176":[4,3,2,5,2,0,0,0,0],"183":[2,1,0,0,0,0,1,0,0],"215":[6,5,0,0,17,10,4,10,17],"8211":[5,4,0,0,0,0,15,0,0],"8212":[7,6,0,0,0,0,63,0,0],"8216":[3,2,1,2,0,0,0,0,0],"8217":[2,1,1,1,0,0,0,0,0],"8220":[5,4,5,10,0,0,0,0,0],"8221":[4,3,5,5,0,0,0,0,0],"8230":[6,5,0,0,0,0,0,0,21],"8592":[7,6,0,0,8,16,63,16,8],"8593":[6,5,4,14,21,4,4,4,4],"8594":[7,6,0,0,4,2,63,2,4],"8595":[6,5,4,4,4,4,21,14,4],"8596":[8,7,0,0,34,65,127,65,34],"8722":[6,5,0,0,0,0,31,0,0],"9632":[6,5,0,31,31,31,31,31,0],"9650":[8,7,0,0,8,28,62,127,0],"9654":[5,4,8,12,14,15,14,12,8],"9660":[8,7,0,0,127,62,28,8,0],"9664":[5,4,1,3,7,15,7,3,1],"9679":[6,5,0,14,31,31,31,14,0],"9733":[8,7,8,28,127,62,28,54,34],"10003":[8,7,0,1,3,70,108,56,16],"57344":[6,5,27,27,27,27,27,27,27],"57345":[6,5,16,24,28,30,28,24,16],"57346":[8,7,99,119,62,28,62,119,99],"57347":[8,7,8,28,42,8,73,65,127],"57348":[8,7,29,35,71,64,65,34,28],"57349":[8,7,0,127,0,127,0,127,0],"57350":[8,7,31,17,113,81,95,68,124],"57351":[8,7,8,8,42,28,73,65,127],"57352":[10,9,0,238,273,381,273,238,0],"57353":[9,8,16,50,245,245,245,50,16],"57354":[9,8,16,48,245,242,245,48,16],"57355":[8,7,8,28,127,62,28,54,34],"57356":[6,5,14,17,17,31,27,27,31],"57357":[6,5,0,4,14,31,14,4,0],"57358":[10,9,0,16,56,124,238,387,511],"57359":[8,7,28,62,127,127,127,62,28],"57360":[8,7,20,62,99,34,99,62,20],"57361":[8,7,0,127,99,85,73,65,127],"57362":[8,7,64,124,126,124,64,64,64],"57363":[8,7,28,42,73,77,65,34,28]};
/*</GEN:glyphs>*/
(function () {
  "use strict";
  var root = document.documentElement;
  var vars = null, lastPx = 0, lastKey = "";

  function px() {
    var v = parseFloat(getComputedStyle(root).getPropertyValue("--px"));
    return v > 0 ? Math.max(1, Math.round(v)) : 2;
  }
  function snap12(n) { return n - (((n - 6) % 12) + 12) % 12; }      // largest 12k+6 <= n: 2/3/4 grid columns stay whole pixels

  var safeProbe = null;
  function safeArea() {
    if (!safeProbe) {
      safeProbe = document.createElement("div");
      safeProbe.setAttribute("aria-hidden", "true");
      safeProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
        "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
      document.body.appendChild(safeProbe);
    }
    var cs = getComputedStyle(safeProbe);
    return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0 };
  }

  function layout() {
    var p = px();
    var ss = document.getElementById("startscreen");
    var cw = (ss && ss.clientWidth) || root.clientWidth || window.innerWidth;
    var ch = window.innerHeight || root.clientHeight;
    var gw = Math.floor(cw / p), gh = Math.floor(ch / p);
    var sa = safeArea();
    var gl = Math.max(6, Math.ceil(sa.l / p)), gr = Math.max(6, Math.ceil(sa.r / p));
    var avail = gw - gl - gr;
    var mw = snap12(Math.min(318, avail));
    if (mw < 78) mw = Math.max(40, avail);
    var mxg = gl + Math.floor((avail - mw) / 2);
    var mx = mxg * p, mxr = Math.max(0, cw - mx - mw * p);
    var cols = mw >= 280 ? 3 : mw >= 150 ? 2 : 1;
    var win = snap12(Math.min(mw, mw <= 222 ? mw : 186, gw - 12));   // phones: full column; big screens: a dialog
    if (win < 78) win = Math.max(40, gw - 12);
    var k = Math.max(2, Math.min(4, Math.floor(mw * 0.92 / 54), Math.floor(gh / 50)));
    var topk = k >= 4 ? 2 : 1;
    var splash = Math.round(Math.max(150, Math.min(360, ch * 0.32)) / p) * p;
    if (gh < 280) splash = Math.round(Math.max(56, Math.min(120, ch * 0.22)) / p) * p;
    var wcls = gw < 190 ? "xs" : gw < 260 ? "s" : gw < 420 ? "m" : "l";
    // two-column dialogs on short screens: whole-pixel columns (left column divisible for its 3 buttons)
    var dw = Math.min(mw, 318), avail = dw - 12 - 10;
    var d2a = Math.floor(avail / 2); d2a -= d2a % 3;
    var p2a = Math.round(avail * 5 / 9); p2a -= p2a % 2;
    // the inline sheet pads the menu with vh units (fractional px): same formulas, rounded
    var W = window.innerWidth, H = ch, sat = sa.t;
    function clampv(a, v, b) { return Math.max(a, Math.min(b, v)); }
    var ptSplash = H <= 560 ? 10 : W <= 680 ? Math.max(sat, 44) + 8 : H <= 760 ? sat + clampv(14, H * 0.05, 48) : sat + Math.max(22, H * 0.12);
    var ptMenu = W > 680 ? sat + clampv(52, H * 0.07, 84) : H <= 560 ? 10 : Math.max(sat, 44) + 8;
    ptSplash = Math.round(ptSplash); ptMenu = Math.round(ptMenu);
    var key = [p, mw, mx, mxr, win, k, topk, splash, cols, wcls, gh < 280 && mw >= 250, d2a, p2a, ptSplash, ptMenu].join(",");
    if (key === lastKey) return;
    lastKey = key;
    if (!vars) {
      vars = document.createElement("style");
      vars.id = "px-ui-vars";
      document.head.appendChild(vars);
    }
    vars.textContent = ":root{--mw:" + mw + ";--win:" + win + ";--mx:" + mx + "px;--mxr:" + mxr + "px;--logo-k:" + k +
      ";--logo-top-k:" + topk + ";--splash-y:" + splash + "px;--d2a:" + d2a + ";--d2b:" + (avail - d2a) + ";--p2a:" + p2a +
      ";--p2b:" + (avail - p2a) + ";--ss-pt:" + ptSplash + "px;--ss-pt-menu:" + ptMenu + "px}";
    root.setAttribute("data-px-ready", "");
    root.setAttribute("data-px-cols", String(cols));
    root.setAttribute("data-px-w", wcls);
    root.setAttribute("data-px-h", gh < 280 && mw >= 250 ? "short" : "tall");      // two-column dialogs need the width too
    hudTitleFit();
    scheduleCrisp();
    scheduleThumbs();
  }

  /* ---- HUD watermark: letter-spaced when there is room, tight when there is less, hidden when it would touch the score */
  var touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  var lastTitle = "";
  function hudTitleFit() {
    var t = document.getElementById("title"), d = document.getElementById("dist");
    if (!t || !d) return;
    var p = px(), cw = root.clientWidth || window.innerWidth, gw = Math.floor(cw / p);
    var text = (t.textContent || "").trim();
    var first = d.firstChild && d.firstChild.nodeType === 3 ? d.firstChild.nodeValue : (d.textContent || "");
    var digits = Math.max(5, (first || "").trim().length);                 // e.g. "0261m"; grows to "10000m"
    var dist = measure(new Array(digits).join("0") + "m", 1) + 8 + 4;    // readout + right margin + gap
    var tapU = Math.ceil(Math.max(44, 15 * p) / p);
    var side = Math.max(dist, touch ? 6 + tapU + 4 : 0);
    var tight = measure(text, 1), wide = tight + text.length;
    var mode = wide + 2 * side <= gw ? "wide" : tight + 2 * side <= gw ? "tight" : "hide";
    if (mode !== lastTitle) { lastTitle = mode; root.setAttribute("data-px-title", mode); }
  }

  /* ---- logo: "MYTH OF" overline + "SISYPHUS" (text content is unchanged for screen readers) */
  function logo() {
    var t = document.querySelector("#startscreen .s-title");
    if (!t || t.querySelector(".pxl-main")) return;
    var m = /^(.*\S)\s+(\S+)$/.exec((t.textContent || "").trim());
    if (!m) return;
    var a = document.createElement("span"), b = document.createElement("span");
    a.className = "pxl-top"; a.textContent = m[1];
    b.className = "pxl-main"; b.textContent = m[2];
    // two clipped copies paint the light bands of the letters (aria-hidden, so screen readers hear it once)
    ["pxl-b1", "pxl-b2"].forEach(function (c) {
      var band = document.createElement("span");
      band.className = "pxl-band " + c; band.setAttribute("aria-hidden", "true"); band.textContent = m[2];
      b.appendChild(band);
    });
    t.textContent = "";
    t.appendChild(a); t.appendChild(document.createTextNode(" ")); t.appendChild(b);
  }

  /* ---- realm thumbnails on the game-pixel grid */
  var imgCache = {}, mosaicCache = {}, thumbTimer = 0;
  function scheduleThumbs() { clearTimeout(thumbTimer); thumbTimer = setTimeout(thumbs, 60); }
  function urlOf(bg) { var m = /url\(["']?(.*?)["']?\)/.exec(bg || ""); return m ? m[1] : ""; }
  function load(src, cb) {
    var e = imgCache[src];
    if (e && e.done) { if (e.img) cb(e.img); return; }
    if (!e) {
      e = imgCache[src] = { done: false, img: null, q: [] };
      var im = new Image();
      im.onload = function () { e.done = true; e.img = im; e.q.forEach(function (f) { f(im); }); e.q = []; };
      im.onerror = function () { e.done = true; e.q = []; };
      im.src = src;
    }
    e.q.push(cb);
  }
  function mosaic(img, w, h) {
    var key = img.src.slice(0, 200) + "|" + img.src.length + "|" + w + "x" + h;
    if (mosaicCache[key]) return mosaicCache[key];
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var s = Math.max(w / nw, h / nh), sw = w / s, sh = h / s;
    var sx = (nw - sw) / 2, sy = (nh - sh) * 0.55;
    // step down by halves so the resample averages instead of aliasing
    var src = img, cw = sw, chh = sh, ox = sx, oy = sy;
    while (cw / 2 > w * 1.5) {
      var t = document.createElement("canvas");
      t.width = Math.max(1, Math.round(cw / 2)); t.height = Math.max(1, Math.round(chh / 2));
      var tg = t.getContext("2d"); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = "high";
      tg.drawImage(src, ox, oy, cw, chh, 0, 0, t.width, t.height);
      src = t; cw = t.width; chh = t.height; ox = 0; oy = 0;
    }
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(src, ox, oy, cw, chh, 0, 0, w, h);
    // posterise with a 4x4 ordered dither: painted art reads as pixel art on the same grid
    try {
      var d = g.getImageData(0, 0, w, h), a = d.data;
      var B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], L = 24;
      for (var y = 0, i = 0; y < h; y++) for (var x = 0; x < w; x++, i += 4) {
        var th = (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
        for (var ch = 0; ch < 3; ch++) {
          var v = a[i + ch] / 255 * (L - 1) + th;
          a[i + ch] = Math.max(0, Math.min(255, Math.round(v) * 255 / (L - 1)));
        }
      }
      g.putImageData(d, 0, 0);
    } catch (err) { /* tainted canvas: keep the plain resample */ }
    var url;
    try { url = c.toDataURL("image/png"); } catch (err2) { url = ""; }
    mosaicCache[key] = url;
    return url;
  }
  // ui.css hides card backgrounds until a pixel thumbnail is painted; read the stylesheet image via a probe
  function classBg(card) {
    var probe = document.createElement("div");
    probe.className = card.className;
    probe.setAttribute("data-px-bg", "probe");
    probe.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden";
    card.parentNode.appendChild(probe);
    var u = urlOf(getComputedStyle(probe).backgroundImage);
    card.parentNode.removeChild(probe);
    return u;
  }
  function set(st, prop, val) { if (st[prop] !== val) st[prop] = val; }   // no-op writes would re-trigger the observer
  function paint(card, url, w, h) {                  // a thumbnail that is exactly w x h game pixels
    var st = card.style, p = px();
    if (urlOf(st.backgroundImage) !== url) set(st, "backgroundImage", 'url("' + url + '")');
    set(st, "backgroundSize", w * p + "px " + h * p + "px");
    set(st, "backgroundPosition", "0px 0px");
    set(st, "backgroundRepeat", "no-repeat");
    card.setAttribute("data-px-bg", st.backgroundImage);
  }
  function thumbs() {
    var cards = document.querySelectorAll("#realmchoices .realm-choice");
    if (!cards.length) return;
    var p = px();
    Array.prototype.forEach.call(cards, function (card) {
      var w = Math.round(card.offsetWidth / p), h = Math.round(card.offsetHeight / p);
      if (!w || !h) return;
      var id = card.dataset ? card.dataset.realm : "";
      var V = window.V8;
      if (id && V && V.has && V.has(id) && V.thumbnailAsync && card.getAttribute("data-px-v8") !== "none") {
        // the realm paints its own card at exactly the card's size in game pixels
        var want = id + "|" + w + "x" + h;
        var done = card.getAttribute("data-px-v8url");
        if (card.getAttribute("data-px-v8") === want) { if (done) paint(card, done, w, h); return; }
        card.setAttribute("data-px-v8", want);
        V.thumbnailAsync(id, w, h, function (url) {
          if (card.getAttribute("data-px-v8") !== want) return;          // a newer size was requested meanwhile
          if (!url) { card.setAttribute("data-px-v8", "none"); scheduleThumbs(); return; }
          card.setAttribute("data-px-v8url", url);
          paint(card, url, w, h);
        });
        return;
      }
      var inline = card.style.backgroundImage || "";
      var src;
      if (inline && inline === card.getAttribute("data-px-bg")) src = card.getAttribute("data-px-src");
      else src = urlOf(inline) || card.getAttribute("data-px-src") || classBg(card);
      card.setAttribute("data-px-src", src || "");
      if (!src) return;
      load(src, function (img) {
        var nw = img.naturalWidth, nh = img.naturalHeight;
        if (!nw || !nh) return;
        var st = card.style;
        if (nw <= 640 && nh <= 360) {
          // pixel art painted by the realm: whole-number scale, cropped, offset on the grid
          var k = Math.max(1, Math.ceil(Math.max(w / nw, h / nh)));
          var bw = nw * k, bh = nh * k;
          var ox = Math.floor((w - bw) / 2), oy = Math.round((h - bh) * 0.6);
          if (urlOf(inline) !== src) set(st, "backgroundImage", 'url("' + src + '")');
          set(st, "backgroundSize", bw * p + "px " + bh * p + "px");
          set(st, "backgroundPosition", ox * p + "px " + oy * p + "px");
        } else {
          var url = mosaic(img, w, h);
          if (!url) return;
          paint(card, url, w, h);
          return;
        }
        set(st, "backgroundRepeat", "no-repeat");
        card.setAttribute("data-px-bg", st.backgroundImage);
      });
    });
  }

  /* ---- pixel tooltips (hover-capable pointers only; the title attribute is restored on leave) */
  function tooltips() {
    if (!window.matchMedia || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    var tip = document.createElement("div");
    tip.id = "px-tip"; tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    var cur = null, timer = 0;
    function hide() {
      clearTimeout(timer);
      tip.classList.remove("show");
      if (cur) {
        var t = cur.getAttribute("data-px-title");
        if (!cur.hasAttribute("title") && t) cur.setAttribute("title", t);
        cur.removeAttribute("data-px-title");
        cur = null;
      }
    }
    function show(el, text) {
      var p = px(), r = el.getBoundingClientRect();
      tip.textContent = text;
      tip.style.left = "0px"; tip.style.top = "0px";
      var tw = tip.offsetWidth, th = tip.offsetHeight, m = 4 * p;
      var x = Math.round((r.left + r.width / 2 - tw / 2) / p) * p;
      x = Math.max(m, Math.min(window.innerWidth - tw - m, x));
      var y = r.top - th - 3 * p;
      if (y < m) y = r.bottom + 5 * p;
      tip.style.left = x + "px";
      tip.style.top = Math.round(y / p) * p + "px";
      tip.classList.add("show");
    }
    document.addEventListener("pointerover", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var el = e.target && e.target.closest ? e.target.closest("[title]") : null;
      if (!el || el === cur || el === document.documentElement || el === document.body) return;
      var text = el.getAttribute("title");
      if (!text) return;
      hide();
      cur = el;
      el.setAttribute("data-px-title", text);
      el.removeAttribute("title");
      timer = setTimeout(function () { if (cur === el) show(el, text); }, 380);
    });
    document.addEventListener("pointerout", function (e) {
      if (!cur || (e.relatedTarget && cur.contains(e.relatedTarget))) return;
      hide();
    });
    ["scroll", "pointerdown", "keydown", "blur"].forEach(function (ev) { window.addEventListener(ev, hide, true); });
  }

  /* ---- crisp pass: centred boxes and labels can land on half pixels (odd --px, odd viewport widths).
     Dialog boxes get a sub-pixel translate (written into a stylesheet, so no DOM mutations) that puts
     them on whole device pixels; centred labels whose text starts mid-pixel get a 1px text-indent (= a
     half-pixel shift). Skipped on fractional device-pixel ratios, where nothing can be exact. */
  var SNAP = ["#pausescreen > :nth-child(1)", "#pausescreen > :nth-child(2)", "#pausescreen > :nth-child(3)",
    "#pausescreen > :nth-child(4)", "#pausescreen > :nth-child(5)", "#gameover .gameover-panel", "#againpanel .again-panel",
    "#postcard .postcard-panel", "#modebanner", "#sharetoast"];
  var NUDGE = "button, #pausescreen .p-title, #pausescreen .p-sub, #gameover .go-title, #gameover .go-score, #gameover .go-sub, " +
    "#againpanel .again-title, #againpanel .again-sub, #postcard .postcard-title, #startscreen .legacy-line, #modebanner, #sharetoast, #title";
  var snapSheet = null, crispTimer = 0;
  function frac(v) { var f = v - Math.floor(v + 0.002); return f < 0.002 || f > 0.998 ? 0 : f; }
  function firstText(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) if (t.nodeValue.trim()) return t;
    return null;
  }
  function crisp() {
    var dpr = window.devicePixelRatio || 1;
    if (Math.abs(dpr - Math.round(dpr)) > 0.01) return;
    if (!snapSheet) { snapSheet = document.createElement("style"); snapSheet.id = "px-ui-snap"; document.head.appendChild(snapSheet); }
    snapSheet.textContent = "";
    var nud = document.querySelectorAll(NUDGE), i, css = "";
    for (i = 0; i < nud.length; i++) if (nud[i].hasAttribute("data-px-nudge")) nud[i].removeAttribute("data-px-nudge");
    for (i = 0; i < SNAP.length; i++) {
      var el = document.querySelector(SNAP[i]);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (!r.width) continue;
      var fx = frac(r.left * dpr) / dpr, fy = frac(r.top * dpr) / dpr;
      if (fx || fy) css += "html body " + SNAP[i] + "{translate:" + (-fx).toFixed(4) + "px " + (-fy).toFixed(4) + "px}";
    }
    snapSheet.textContent = css;
    var fix = [];
    for (i = 0; i < nud.length; i++) {
      var t = firstText(nud[i]);
      if (!t) continue;
      var rg = document.createRange(); rg.selectNodeContents(t);
      var b = rg.getBoundingClientRect();
      if (b.width && frac(b.left * dpr)) fix.push(nud[i]);
    }
    for (i = 0; i < fix.length; i++) fix[i].setAttribute("data-px-nudge", "");
  }
  function scheduleCrisp(delay) {
    clearTimeout(crispTimer);
    crispTimer = setTimeout(function () { requestAnimationFrame(crisp); }, delay == null ? 40 : delay);
  }

  /* ---- bitmap text for canvas code: PixelUI.drawText(ctx, "0123m", x, y, {color, scale, align, shadow}) */
  var G = window.PIXEL_GLYPHS || {};
  function glyph(ch) { return G[ch.charCodeAt(0)] || G[63]; }
  function measure(text, scale) {
    var w = 0, s = scale || 1;
    for (var i = 0; i < text.length; i++) { var g = glyph(text[i]); w += g ? g[0] : 4; }
    return Math.max(0, w - 1) * s;
  }
  function drawRuns(ctx, text, x, y, s) {
    for (var i = 0; i < text.length; i++) {
      var g = glyph(text[i]);
      if (!g) { x += 4 * s; continue; }
      var gw = g[1];
      for (var r = 2; r < g.length; r++) {
        var bits = g[r], run = -1;
        for (var c = 0; c <= gw; c++) {
          var on = c < gw && (bits >> (gw - 1 - c)) & 1;
          if (on && run < 0) run = c;
          else if (!on && run >= 0) { ctx.fillRect(x + run * s, y + (r - 2) * s, (c - run) * s, s); run = -1; }
        }
      }
      x += g[0] * s;
    }
  }
  /* drawText(g, str, x, y, size, color, shadow, align, baseline)
       size     integer scale: 1 = 7-px capitals on an 11-px line (values > 4 are read as a CSS-style px size: 8->1, 16->2)
       color    fill (default cream); shadow: colour of a hard 1-pixel drop shadow (optional)
       align    "left"|"start"|"center"|"right"|"end" (default: g.textAlign)
       baseline "alphabetic"|"top"|"middle"|"bottom"|"hanging"|"ideographic" (default: g.textBaseline)
     also drawText(g, str, x, y, {size|scale, color, shadow, outline, align, baseline}). Returns the width in canvas px. */
  function drawText(ctx, text, x, y, size, color, shadow, align, baseline) {
    var o = size && typeof size === "object" ? size : { size: size, color: color, shadow: shadow, align: align, baseline: baseline };
    text = String(text == null ? "" : text);
    var sz = o.scale || o.size || 1;
    var s = sz > 4 ? Math.max(1, Math.floor(sz / 8)) : Math.max(1, Math.round(sz));
    var w = measure(text, s);
    var al = o.align || ctx.textAlign || "left", bl = o.baseline || ctx.textBaseline || "alphabetic";
    var dir = ctx.direction === "rtl";
    var x0 = al === "center" ? x - w / 2 : (al === "right" || (al === "end" && !dir) || (al === "start" && dir)) ? x - w : x;
    // y0 = the row of the capital tops: "top" puts the caps' top at y, "middle" centres the caps on y,
    // "alphabetic" sits them on y, "bottom" puts the descender line (2 px under the baseline) on y
    var y0 = bl === "top" || bl === "hanging" ? y : bl === "middle" ? y - 3.5 * s : bl === "bottom" || bl === "ideographic" ? y - 9 * s : y - 7 * s;
    x0 = Math.round(x0); y0 = Math.round(y0);
    // rendered once into a small cached canvas (the HUD redraws the same strings every frame)
    var key = text + "\u0001" + s + "\u0001" + (o.color || "") + "\u0001" + (o.shadow || "") + "\u0001" + (o.outline || "");
    var c = textCache[key];
    if (!c) {
      if (++textCacheN > 400) { textCache = {}; textCacheN = 1; }
      c = document.createElement("canvas");
      c.width = Math.max(1, w + 2 * s); c.height = 11 * s;           // 1 px margin each side, 9 px of glyph rows + outline
      var cg = c.getContext("2d");
      if (o.outline) {
        cg.fillStyle = o.outline;
        for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) if (ox || oy) drawRuns(cg, text, s + ox * s, s + oy * s, s);
      }
      if (o.shadow) { cg.fillStyle = o.shadow; drawRuns(cg, text, s, 2 * s, s); }
      cg.fillStyle = o.color || "#f4ecd8";
      drawRuns(cg, text, s, s, s);
      textCache[key] = c;
    }
    var sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, x0 - s, y0 - s);
    ctx.imageSmoothingEnabled = sm;
    return w;
  }
  var textCache = {}, textCacheN = 0;
  window.PixelUI = { drawText: drawText, measure: measure, refresh: function () { lastKey = ""; layout(); }, glyphs: G };

  /* ---- wiring */
  function init() {
    logo();
    layout();
    tooltips();
    var raf = 0;
    function relayout() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; layout(); }); }
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", function () { setTimeout(relayout, 250); });
    // the game rewrites --px (fine/chunky, rotation) on <html style>
    new MutationObserver(function () { var p = px(); if (p !== lastPx) { lastPx = p; relayout(); } })
      .observe(root, { attributes: true, attributeFilter: ["style"] });
    lastPx = px();
    var ss = document.getElementById("startscreen");
    if (ss && window.ResizeObserver) new ResizeObserver(relayout).observe(ss);
    var dist = document.getElementById("dist");
    if (dist) new MutationObserver(function () { hudTitleFit(); }).observe(dist, { childList: true, characterData: true, subtree: true });
    var rc = document.getElementById("realmchoices");
    if (rc) {
      new MutationObserver(scheduleThumbs).observe(rc, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
      if (window.ResizeObserver) new ResizeObserver(scheduleThumbs).observe(rc);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { relayout(); scheduleCrisp(); });
    // re-run the crisp pass whenever a panel opens or a centred label changes its text
    var lateCrisp = 0;
    var crispObs = new MutationObserver(function () { scheduleCrisp(); clearTimeout(lateCrisp); lateCrisp = setTimeout(scheduleCrisp, 260); });
    ["pausescreen", "gameover", "againpanel", "postcard", "startscreen", "modebanner", "sharetoast", "titlewrap"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) crispObs.observe(el, { attributes: true, attributeFilter: ["class", "style", "open"] });
    });
    ["startselected", "realmcontinue", "gameoverrestart", "againleave", "modebanner", "sharetoast", "gameovertitle", "gameoverscore",
     "gameoversub", "againsub", "pausefacts"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) crispObs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
