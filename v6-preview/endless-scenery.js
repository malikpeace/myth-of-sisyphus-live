(function (root) {
  "use strict";
  function mix(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  function css(c) { return "rgb(" + c.join(",") + ")"; }
  function hash(n) { var v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  function Scenery() { this.layers = []; this.trees = new Map(); this.highlands = []; }
  Scenery.prototype.tree = function (image, height, color, tint) {
    tint = tint == null ? 0.72 : tint;
    height = Math.max(8, Math.round(height / 4) * 4);
    var key = height + ":" + color.join(",") + ":" + tint;
    if (this.trees.has(key)) return this.trees.get(key);
    var stamp = document.createElement("canvas");
    stamp.height = height;
    stamp.width = Math.max(3, Math.round(height * image.naturalWidth / image.naturalHeight));
    var c = stamp.getContext("2d");
    c.imageSmoothingEnabled = false;
    c.drawImage(image, 0, 0, stamp.width, stamp.height);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(" + color.join(",") + "," + tint + ")";
    c.fillRect(0, 0, stamp.width, stamp.height);
    if (this.trees.size >= 96) this.trees.delete(this.trees.keys().next().value);
    this.trees.set(key, stamp);
    return stamp;
  };
  Scenery.prototype.draw = function (g, options) {
    var w = options.width, h = options.height, day = options.day;
    var image = options.tree;
    if (options.opacity < 0.005 || !image || !image.complete || !image.naturalWidth) return;
    var air = mix(day.sky[2], day.far || [85, 122, 146], 0.35);
    var forest = mix([24, 51, 46], day.mid || [35, 57, 77], 0.35);
    for (var depth = 0; depth < 3; depth++) {
      var shift = Math.round(options.metres * [0.13, 0.24, 0.43][depth]);
      var color = mix(forest, air, [0.78, 0.55, 0.28][depth]);
      color = color.map(function (v) { return Math.round(v / 3) * 3; });
      var key = [w, h, shift, color.join(","), options.opening].join("|");
      var layer = this.layers[depth];
      if (!layer) layer = this.layers[depth] = { canvas: document.createElement("canvas"), key: "" };
      if (layer.key !== key) {
        layer.key = key;
        var c = layer.canvas;
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        var ctx = c.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        var seed = depth * 131;
        var baseline = h * (0.55 + depth * 0.035) + options.opening;
        var amplitude = h * (0.026 + depth * 0.003);
        function ridge(x) {
          return Math.round(baseline + Math.sin((x + seed) * 0.013) * amplitude + Math.sin((x - seed) * 0.031) * amplitude * 0.24);
        }
        ctx.fillStyle = css(color);
        for (var x = 0; x < w; x++) {
          var top = ridge(x + shift);
          ctx.fillRect(x, top, 1, Math.max(0, h - top));
        }
        var spacing = [5, 7, 9][depth];
        var start = Math.floor((shift - 40) / spacing);
        var end = Math.ceil((shift + w + 40) / spacing);
        for (var i = start; i <= end; i++) {
          // Gaps belong to the landscape, never to the current frame.
          if (hash(i + seed) < 0.16) continue;
          var worldX = Math.round(i * spacing + hash(i * 3 + seed) * spacing * 0.65);
          var treeH = (9 + depth * 7) * (0.60 + hash(i * 7 + seed) * 0.90);
          var stamp = this.tree(image, treeH, color);
          ctx.drawImage(stamp, Math.round(worldX - shift - stamp.width / 2), ridge(worldX) - stamp.height + 3);
        }
      }
      g.save();
      g.globalAlpha = options.opacity;
      g.imageSmoothingEnabled = false;
      g.drawImage(layer.canvas, 0, 0);
      g.restore();
    }
    if (options.titleAlpha > 0.005) this.titleForest(g, options);
  };
  Scenery.prototype.titleForest = function (g, options) {
    var w = options.width, h = options.height, image = options.tree;
    var night = Math.max(options.day.night || 0, options.day.sky[0][0] < 25 ? 1 : 0);
    var palette = [[58, 83, 76], [37, 62, 55], [24, 44, 38], [14, 29, 26]].map(function (c) {
      return mix(c, [8, 15, 29], night * 0.72);
    });
    var key = [w, h, palette.join(";")].join("|");
    if (!this.titleLayer || this.titleKey !== key) {
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
      for (var depth = 0; depth < 4; depth++) {
        var base = h * (0.78 + depth * 0.125);
        var spacing = Math.max(9, Math.round(h * (0.027 + depth * 0.012)));
        var color = palette[depth];
        ctx.fillStyle = css(color);
        for (var x = 0; x < w; x++) {
          var y = Math.round(base + Math.sin(x / w * 5.2 + depth * 1.8) * h * 0.035);
          ctx.fillRect(x, y, 1, Math.max(0, h - y));
        }
        for (var i = -2; i <= Math.ceil(w / spacing) + 2; i++) {
          var seed = i * 7.3 + depth * 53;
          var tx = Math.round(i * spacing + hash(seed) * spacing * 0.7);
          var ty = Math.round(base + Math.sin(tx / w * 5.2 + depth * 1.8) * h * 0.035);
          var height = h * (0.11 + depth * 0.065) * (0.8 + hash(seed + 11) * 0.55);
          var stamp = this.tree(image, height, color, 0.66 - depth * 0.07);
          ctx.drawImage(stamp, tx - Math.round(stamp.width / 2), ty - stamp.height);
        }
      }
      this.titleLayer = c; this.titleKey = key;
    }
    g.save(); g.globalAlpha = options.titleAlpha;
    g.imageSmoothingEnabled = false; g.drawImage(this.titleLayer, 0, 0); g.restore();
  };
  Scenery.prototype.highland = function (g, options) {
    var image = options.mountains, w = options.width, h = options.height;
    if (options.opacity < 0.005 || !image.complete || !image.naturalWidth) return;
    g.save();
    for (var star = 0; star < 100; star++) {
      var a = options.opacity * (0.2 + hash(star * 1.7) * 0.5);
      a *= 0.78 + Math.sin(options.time * 0.6 + star) * 0.22;
      g.fillStyle = "rgba(199,216,236," + a + ")";
      g.fillRect(Math.round(hash(star * 3.2) * w), Math.round(hash(star * 7.8) * h * 0.72), 1, 1);
    }
    for (var depth = 0; depth < 2; depth++) {
      var height = Math.round(h * (0.52 + depth * 0.15));
      var width = Math.round(height * image.naturalWidth / image.naturalHeight);
      var plate = this.highlands[depth];
      if (!plate || plate.height !== height) {
        plate = document.createElement("canvas");
        plate.width = width; plate.height = height;
        var ctx = plate.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, width, height);
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = depth ? "rgba(10,18,32,0.88)" : "rgba(29,39,62,0.86)";
        ctx.fillRect(0, 0, width, height);
        this.highlands[depth] = plate;
      }
      var scroll = Math.round(options.metres * (0.025 + depth * 0.04));
      var baseY = Math.round(h * (0.83 + depth * 0.16) - height);
      g.globalAlpha = options.opacity;
      for (var tile = Math.floor(scroll / width) - 1; tile <= Math.ceil((scroll + w) / width); tile++) {
        var x = tile * width - scroll;
        g.save();
        g.translate(Math.round(x), baseY);
        if (Math.abs(tile % 2) === 1) { g.translate(width, 0); g.scale(-1, 1); }
        g.drawImage(plate, 0, 0);
        g.restore();
      }
    }
    g.restore();
  };
  root.SisyphusScenery = Scenery;
})(window);
