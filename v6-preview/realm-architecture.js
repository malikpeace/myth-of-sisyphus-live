(function (root) {
  "use strict";
  function hash(n) { var v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
  var palettes = {
    forest: ["#18242d", "#27343d", "#344550", "#465664", "#61727b"],
    moon: ["#101726", "#202a3d", "#344158", "#51617a", "#8994ab"],
    sunset: ["#302330", "#513744", "#775050", "#a87761", "#dca777"]
  };
  function Architecture() { this.tiles = new Map(); }
  Architecture.prototype.waterfall = function (g, o) {
    var image = o.image;
    if (!image || !image.complete || !image.naturalWidth) return false;
    var scale = Math.max(o.width / image.naturalWidth, o.height / image.naturalHeight) * 1.08;
    var w = Math.ceil(image.naturalWidth * scale), h = Math.ceil(image.naturalHeight * scale);
    var margin = Math.max(0, (w - o.width) / 2);
    var shift = Math.max(-margin, Math.min(margin, o.scroll * 0.025));
    var x = Math.round((o.width - w) / 2 - shift), y = Math.round((o.height - h) * 0.35);
    g.save(); g.globalAlpha *= o.opacity; g.imageSmoothingEnabled = false;
    g.drawImage(image, x, y, w, h);
    if (!o.reduced) {
      // Trace the authored channels rather than letting straight streaks cross rock.
      var falls = o.portrait ? [
        [[.15,.20],[.175,.31],[.21,.35],[.22,.51],[.27,.72],[.31,.82]],
        [[.855,.20],[.83,.29],[.79,.34],[.76,.48],[.755,.70],[.68,.87]],
        [[.56,.28],[.54,.42],[.51,.62]]
      ] : [
        [[.153,.27],[.17,.52],[.195,.66],[.24,.89]],
        [[.325,.35],[.34,.56],[.35,.68]],
        [[.91,.26],[.89,.45],[.858,.62],[.83,.80]],
        [[.69,.55],[.655,.71],[.622,.82]]
      ];
      g.fillStyle = "rgba(182,206,210,0.18)";
      for (var f = 0; f < falls.length; f++) {
        var fall = falls[f];
        for (var p = 0; p < 14; p++) {
          var along = ((o.time * (0.19 + f * 0.02) + p / 14) % 1);
          var fy=fall[0][1]+along*(fall[fall.length-1][1]-fall[0][1]), segment=0;
          while(segment<fall.length-2 && fy>fall[segment+1][1])segment++;
          var a=fall[segment],b=fall[segment+1],t=(fy-a[1])/(b[1]-a[1]);
          var fx=a[0]+(b[0]-a[0])*t;
          var px = Math.round(x + w * (fx + (hash(p + f * 41) - 0.5) * 0.006));
          var py = Math.round(y + h * fy);
          g.fillRect(px, py, 1, 3);
        }
      }
    }
    g.restore(); return true;
  };
  Architecture.prototype.tile = function (palette) {
    if (this.tiles.has(palette)) return this.tiles.get(palette);
    var colors = palettes[palette] || palettes.forest;
    var tile = document.createElement("canvas"); tile.width = 128; tile.height = 64;
    var c = tile.getContext("2d");
    c.fillStyle = colors[0]; c.fillRect(0, 0, 128, 64);
    for (var row = 0; row < 4; row++) for (var col = -1; col < 5; col++) {
      var seed = row * 19 + (col + 4) % 4 * 7;
      var x = col * 32 + row % 2 * 16, y = row * 16;
      c.fillStyle = colors[hash(seed + 2) > 0.78 ? 1 : 2]; c.fillRect(x + 1, y + 1, 30, 14);
      c.fillStyle = colors[1]; c.fillRect(x + 1, y + 12, 30, 2);
      c.fillStyle = colors[3]; c.fillRect(x + 2, y + 1, 12 + Math.floor(hash(seed) * 15), 1);
      c.fillStyle = colors[0]; c.fillRect(x + 1, y + 14, 30, 1);
      if (hash(seed + 4) > 0.4) { c.fillRect(x + 25, y + 8, 1, 3); c.fillRect(x + 24, y + 11, 1, 2); }
      for (var patch = 0; patch < 3; patch++) {
        var px = x + 3 + Math.floor(hash(seed + patch * 13) * 21);
        var py = y + 3 + Math.floor(hash(seed + patch * 7) * 8);
        c.fillStyle = colors[hash(seed + patch * 5) > 0.70 ? 3 : 1];
        c.fillRect(px, py, 2 + Math.floor(hash(seed + patch) * 6), 1 + Math.floor(hash(seed + patch + 4) * 2));
      }
      c.fillStyle = colors[0];
      c.fillRect(x + 1, y + 1, 2, 1); c.fillRect(x + 29, y + 13, 2, 1);
    }
    this.tiles.set(palette, tile);
    return tile;
  };
  Architecture.prototype.bridge = function (g, o) {
    var colors = palettes[o.palette] || palettes.forest;
    var tile = this.tile(o.palette), span = o.span || 112, pier = o.pier || 22;
    var depth = o.depth || 120, scroll = Math.round(o.scroll || 0);
    var w = Math.ceil(o.width), h = Math.ceil(o.height);
    g.save(); g.imageSmoothingEnabled = false; g.beginPath();
    // The same deck sample anchors masonry, contact shadows, and the actor.
    // Arch holes are empty receiver pixels, not dark shapes painted over scenery.
    for (var x = 0; x < w; x++) {
      var top = Math.round(o.surface(x)), phase = ((x + scroll) % span + span) % span;
      var u = (phase - span / 2) / ((span - pier) / 2);
      var radius=(span-pier)/2;
      var masonry = Math.abs(u) >= 1 ? depth : 22 + (1 - Math.sqrt(1 - u * u)) * radius;
      g.rect(x, top, 1, Math.max(0, Math.min(h - top, Math.round(masonry))));
    }
    g.clip();
    var pattern = g.createPattern(tile, "repeat");
    g.translate(-(scroll % tile.width), 0); g.fillStyle = pattern;
    g.fillRect(scroll % tile.width, 0, w, h); g.translate(scroll % tile.width, 0);
    for (var px = 0; px < w; px++) {
      var y = Math.round(o.surface(px));
      var local=((px+scroll)%span+span)%span-span/2;
      var archRadius=(span-pier)/2;
      if(Math.abs(local)<archRadius){
        var inner=Math.round(22+archRadius-Math.sqrt(archRadius*archRadius-local*local));
        var angle=Math.acos(Math.max(-1,Math.min(1,local/archRadius)));
        var block=angle/Math.PI*13;
        g.fillStyle=colors[2+(Math.floor(block)%3===0?1:0)];g.fillRect(px,y+inner-10,1,10);
        g.fillStyle=colors[0];g.fillRect(px,y+inner-2,1,2);
        if(block-Math.floor(block)<0.08){g.fillStyle=colors[1];g.fillRect(px,y+inner-10,1,9);}
      }
      g.fillStyle = colors[4]; g.fillRect(px, y, 1, 2);
      g.fillStyle = colors[2]; g.fillRect(px, y + 2, 1, 4);
      g.fillStyle = colors[0]; g.fillRect(px, y + 6, 1, 2);
      if (((px + scroll) % 24 + 24) % 24 === 0) g.fillRect(px, y, 1, 6);
    }
    g.restore();
  };
  Architecture.prototype.column = function (g, o) {
    var colors = palettes[o.palette] || palettes.moon;
    var x = Math.round(o.x), base = Math.round(o.base), height = Math.round(o.height);
    var width = Math.max(10, Math.round((o.proportion || height) * 0.10)), top = base - height;
    g.save();
    g.fillStyle = colors[0]; g.fillRect(x - width - 2, base - 4, width * 2 + 4, 4);
    g.fillStyle = colors[2]; g.fillRect(x - width, base - 8, width * 2, 4);
    g.fillStyle = colors[3]; g.fillRect(x - width, base - 8, width * 2 - 2, 1);
    g.fillStyle = colors[1]; g.fillRect(x - width + 3, base - 11, width * 2 - 6, 3);
    g.fillStyle = colors[3]; g.fillRect(x - width + 4, base - 12, width * 2 - 8, 1);
    for (var row = 0; row < height - 22; row++) {
      var taper = Math.floor(row / height * 3), half = Math.floor(width / 2) + taper;
      var y = top + 10 + row;
      g.fillStyle = colors[1]; g.fillRect(x - half, y, half * 2, 1);
      for(var flute=-half+1;flute<half-2;flute+=4){
        g.fillStyle=colors[flute<0?3:2];g.fillRect(x+flute,y,2,1);
        g.fillStyle=colors[1];g.fillRect(x+flute+2,y,1,1);
      }
      g.fillStyle = colors[0]; g.fillRect(x + half - 2, y, 2, 1);
      if (row % 31 === 0) {g.fillStyle=colors[1];g.fillRect(x - half, y, half * 2, 1);}
      if (row % 67 < 3) {g.fillStyle=colors[1];g.fillRect(x-half+4+Math.floor(row/67)%3,y,3,1);}
    }
    g.fillStyle = colors[2]; g.fillRect(x - width + 1, top + 3, width * 2 - 2, 3);
    g.fillStyle = colors[3]; g.fillRect(x - width, top, width * 2, 3);
    g.fillStyle = colors[4]; g.fillRect(x - width, top, width * 2 - 2, 1);
    g.fillStyle = colors[1]; g.fillRect(x - width + 4, top + 6, width * 2 - 8, 2);
    g.fillStyle = colors[3]; g.fillRect(x - width + 6, top + 8, width * 2 - 12, 2);
    if (o.broken) {
      g.fillStyle = colors[0];
      g.fillRect(x + 1, top, Math.floor(width / 2), 4); g.fillRect(x + 3, top + 4, 2, 4);
    }
    g.restore();
  };
  Architecture.prototype.colonnade = function (g, o) {
    var spacing = o.spacing || 390, scroll = o.scroll || 0;
    var colors=palettes[o.palette] || palettes.moon;
    // Each ruin has a level lintel; shafts meet the stepped hillside separately.
    for (var i = Math.floor((scroll - 220) / spacing); i <= Math.ceil((scroll + o.width + 60) / spacing); i++) {
      var x = Math.round(i * spacing - scroll), gap=84, count=2+(hash(i+23)>.48?1:0);
      var top=Math.round(Math.min(o.surface(x),o.surface(x+gap*(count-1)))-o.height*(.62+hash(i+9)*.15));
      var broken=hash(i*9+3)<.42;
      for(var c=0;c<count;c++){
        var cx=x+c*gap, base=Math.round(o.surface(cx)), ruin=broken && c===count-1;
        this.column(g,{x:cx,base:base,height:base-top-(ruin?o.height*.42:0),proportion:o.height*.75,palette:o.palette,broken:ruin});
      }
      var end=x+gap*(count-1)+(broken?-gap*.38:22),start=x-22;
      for(var bx=start;bx<end;bx++){
        var chipped=bx>end-9?Math.floor((bx-end+9)/3)*2:0;
        g.fillStyle=colors[1];g.fillRect(bx,top-17+chipped,1,17-chipped);
        g.fillStyle=colors[3];g.fillRect(bx,top-17+chipped,1,2);
        g.fillStyle=colors[2];g.fillRect(bx,top-12+chipped,1,6);
        g.fillStyle=colors[0];g.fillRect(bx,top-3,1,3);
        if((bx-start)%12<2){g.fillStyle=colors[0];g.fillRect(bx,top-6,1,3);}
        if((bx-start)%39===0){g.fillStyle=colors[0];g.fillRect(bx,top-15+chipped,1,9-chipped);}
      }
    }
  };
  Architecture.prototype.cherry = function (g, o) {
    var image = o.image;
    if (!image || !image.complete || !image.naturalWidth) return;
    var size = Math.round(o.size), x = Math.round(o.x), bottom = Math.round(o.bottom);
    var time = o.reduced ? 0 : o.time, seed = o.seed || 0;
    g.save(); g.imageSmoothingEnabled = false;
    // Native row offsets bend the canopy while the lower trunk stays planted.
    // No rotated or filtered image is introduced by the wind animation.
    for (var row = 0; row < image.naturalHeight; row++) {
      var influence = Math.pow(1 - row / image.naturalHeight, 2);
      var offset = Math.round(Math.sin(time * 0.8 + seed) * influence * size * 0.014);
      var y0 = Math.round(row * size / image.naturalHeight), y1 = Math.round((row + 1) * size / image.naturalHeight);
      if(y1 > y0) g.drawImage(image, 0, row, image.naturalWidth, 1, x + offset, bottom - size + y0, size, y1 - y0);
    }
    g.restore();
  };
  Architecture.prototype.petals = function (g, o) {
    if (o.reduced) return;
    g.save();
    for (var i = 0; i < 44; i++) {
      var depth = hash(i + 9), speed = 8 + depth * 18;
      var x = ((hash(i * 7) * o.width + o.time * speed) % (o.width + 12)) - 6;
      var y = ((hash(i * 11) * o.height + o.time * (2 + depth * 3)) % (o.height + 12)) - 6;
      y += Math.sin(o.time * 1.1 + i * 2.3) * (3 + depth * 6);
      g.fillStyle = ["#ad6080", "#d9819e", "#f8c4c2"][Math.floor(depth * 3)];
      var size = depth > 0.7 ? 2 : 1;
      g.fillRect(Math.round(x), Math.round(y), size, 1);
      if (size === 2 && Math.sin(o.time * 2 + i) > 0) g.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
    }
    g.restore();
  };
  root.SisyphusRealmArchitecture = Architecture;
})(window);
