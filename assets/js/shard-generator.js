(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";

  var PALETTES = {
    brand: ["#FF5A7A", "#13B5EA", "#4C6FFF", "#B07CFF", "#FFC93C", "#2ED4A6"],
    paper: ["#EDE0C8", "#D9C7A3", "#C9B27D", "#F2E9D8", "#B99B6B", "#E7D5B0"],
    ink: ["#1A1A1A", "#3A3A3A", "#5C5C5C", "#7E7E7E", "#A6A6A6", "#D0D0D0"],
    ocean: ["#012A4A", "#013A63", "#01497C", "#2C7DA0", "#61A5C2", "#A9D6E5"]
  };

  var els = {};
  var shards = [];
  var canvasW = 1200, canvasH = 1200;

  function $(id) { return document.getElementById(id); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmt(n) { return Math.round(n * 100) / 100; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  function polygonPoints(cx, cy, avgRadius, vertexCount, irregularity) {
    var points = [];
    var angleStep = (Math.PI * 2) / vertexCount;
    for (var i = 0; i < vertexCount; i++) {
      var angle = i * angleStep + rand(-angleStep * 0.35, angleStep * 0.35) * irregularity;
      var radius = avgRadius * (1 + rand(-irregularity, irregularity));
      points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return points;
  }

  // rounds every vertex of a closed polygon by cutting in along each
  // adjacent edge and joining the cuts with a quadratic curve through
  // the original vertex, so corners stay soft instead of sharp
  function roundedPolygonPath(points, roundness) {
    var n = points.length;
    var corners = [];
    for (var i = 0; i < n; i++) {
      var prev = points[(i - 1 + n) % n];
      var curr = points[i];
      var next = points[(i + 1) % n];
      var lenPrev = dist(prev, curr);
      var lenNext = dist(curr, next);
      var r = Math.min(lenPrev, lenNext) * roundness;
      var before = lerp(curr, prev, lenPrev > 0 ? r / lenPrev : 0);
      var after = lerp(curr, next, lenNext > 0 ? r / lenNext : 0);
      corners.push({ before: before, corner: curr, after: after });
    }
    var start = corners[n - 1].after;
    var d = "M " + fmt(start.x) + " " + fmt(start.y);
    for (var j = 0; j < n; j++) {
      var c = corners[j];
      d += " L " + fmt(c.before.x) + " " + fmt(c.before.y);
      d += " Q " + fmt(c.corner.x) + " " + fmt(c.corner.y) + " " + fmt(c.after.x) + " " + fmt(c.after.y);
    }
    d += " Z";
    return d;
  }

  function generateShards() {
    var count = parseInt(els.count.value, 10);
    var sizePct = parseInt(els.size.value, 10) / 100;
    var spreadPct = parseInt(els.spread.value, 10) / 100;
    var roundness = parseInt(els.roundness.value, 10) / 100;
    var irregularity = parseInt(els.irregularity.value, 10) / 100;
    var paletteName = els.palette.value;
    var colors = PALETTES[paletteName].slice();

    var minDim = Math.min(canvasW, canvasH);
    var cx0 = canvasW / 2;
    var cy0 = canvasH / 2;

    shards = [];
    for (var i = 0; i < count; i++) {
      var cx = cx0 + rand(-spreadPct, spreadPct) * canvasW * 0.5;
      var cy = cy0 + rand(-spreadPct, spreadPct) * canvasH * 0.5;
      var radius = minDim * sizePct * rand(0.85, 1.15);
      var vertexCount = Math.floor(rand(4, 7));
      var points = polygonPoints(cx, cy, radius, vertexCount, irregularity);
      var path = roundedPolygonPath(points, Math.min(roundness, 0.45));
      var color = colors.length ? colors.splice(Math.floor(Math.random() * colors.length), 1)[0] : pick(PALETTES[paletteName]);

      shards.push({ path: path, color: color });
    }
  }

  function render() {
    var opacity = parseInt(els.opacity.value, 10) / 100;
    var blend = els.blend.checked;
    var shadow = els.shadow.checked;
    var bg = els.bg.value;

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);
    svg.setAttribute("viewBox", "0 0 " + canvasW + " " + canvasH);

    if (shadow) {
      var defs = document.createElementNS(SVG_NS, "defs");
      var filter = document.createElementNS(SVG_NS, "filter");
      filter.setAttribute("id", "sg-shadow-filter");
      filter.setAttribute("x", "-50%");
      filter.setAttribute("y", "-50%");
      filter.setAttribute("width", "200%");
      filter.setAttribute("height", "200%");
      var dropShadow = document.createElementNS(SVG_NS, "feDropShadow");
      dropShadow.setAttribute("dx", "0");
      dropShadow.setAttribute("dy", fmt(canvasH * 0.012));
      dropShadow.setAttribute("stdDeviation", fmt(canvasH * 0.012));
      dropShadow.setAttribute("flood-color", "#000000");
      dropShadow.setAttribute("flood-opacity", "0.22");
      filter.appendChild(dropShadow);
      defs.appendChild(filter);
      svg.appendChild(defs);
    }

    var bgRect = document.createElementNS(SVG_NS, "rect");
    bgRect.setAttribute("x", "0");
    bgRect.setAttribute("y", "0");
    bgRect.setAttribute("width", canvasW);
    bgRect.setAttribute("height", canvasH);
    bgRect.setAttribute("fill", bg);
    svg.appendChild(bgRect);

    var group = document.createElementNS(SVG_NS, "g");
    if (shadow) group.setAttribute("filter", "url(#sg-shadow-filter)");
    svg.appendChild(group);

    shards.forEach(function (shard) {
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", shard.path);
      path.setAttribute("fill", shard.color);
      path.setAttribute("fill-opacity", opacity);
      if (blend) path.setAttribute("style", "mix-blend-mode: multiply");
      group.appendChild(path);
    });

    var stage = els.stage;
    stage.innerHTML = "";
    stage.appendChild(svg);

    var wrap = els.previewWrap;
    var scale = Math.min(wrap.clientWidth / canvasW, wrap.clientHeight / canvasH, 1);
    stage.style.width = canvasW + "px";
    stage.style.height = canvasH + "px";
    stage.style.transform = "scale(" + scale + ")";
  }

  function regenerate() {
    generateShards();
    render();
  }

  function readCanvasSize() {
    canvasW = parseInt(els.w.value, 10) || 1200;
    canvasH = parseInt(els.h.value, 10) || 1200;
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportSVG() {
    var svg = els.stage.querySelector("svg");
    var serialized = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([serialized], { type: "image/svg+xml" });
    downloadBlob(blob, "xero-shards-" + canvasW + "x" + canvasH + ".svg");
  }

  function exportPNG() {
    var svg = els.stage.querySelector("svg");
    var serialized = new XMLSerializer().serializeToString(svg);
    var svgBlob = new Blob([serialized], { type: "image/svg+xml" });
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        downloadBlob(blob, "xero-shards-" + canvasW + "x" + canvasH + ".png");
      }, "image/png");
    };
    img.src = url;
  }

  function updateReadouts() {
    els.countValue.textContent = els.count.value;
    els.sizeValue.textContent = els.size.value + "%";
    els.spreadValue.textContent = els.spread.value + "%";
    els.roundnessValue.textContent = els.roundness.value + "%";
    els.irregularityValue.textContent = els.irregularity.value + "%";
    els.opacityValue.textContent = els.opacity.value + "%";
  }

  function init() {
    els.count = $("sg-count");
    els.countValue = $("sg-count-value");
    els.w = $("sg-w");
    els.h = $("sg-h");
    els.size = $("sg-size");
    els.sizeValue = $("sg-size-value");
    els.spread = $("sg-spread");
    els.spreadValue = $("sg-spread-value");
    els.roundness = $("sg-roundness");
    els.roundnessValue = $("sg-roundness-value");
    els.irregularity = $("sg-irregularity");
    els.irregularityValue = $("sg-irregularity-value");
    els.palette = $("sg-palette");
    els.opacity = $("sg-opacity");
    els.opacityValue = $("sg-opacity-value");
    els.bg = $("sg-bg");
    els.shadow = $("sg-shadow");
    els.blend = $("sg-blend");
    els.shuffle = $("sg-shuffle");
    els.exportPng = $("sg-export-png");
    els.exportSvg = $("sg-export-svg");
    els.stage = $("sg-stage");
    els.previewWrap = $("sg-preview-wrap");

    updateReadouts();

    [els.count, els.size, els.spread, els.roundness, els.irregularity].forEach(function (input) {
      input.addEventListener("input", function () {
        updateReadouts();
        regenerate();
      });
    });
    els.palette.addEventListener("change", regenerate);
    [els.w, els.h].forEach(function (input) {
      input.addEventListener("change", function () {
        readCanvasSize();
        regenerate();
      });
    });
    els.opacity.addEventListener("input", function () {
      updateReadouts();
      render();
    });
    els.bg.addEventListener("input", render);
    els.shadow.addEventListener("change", render);
    els.blend.addEventListener("change", render);
    els.shuffle.addEventListener("click", regenerate);
    els.exportPng.addEventListener("click", exportPNG);
    els.exportSvg.addEventListener("click", exportSVG);
    window.addEventListener("resize", render);

    readCanvasSize();
    regenerate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
