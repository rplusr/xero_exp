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
  function fmt(n) { return Math.round(n * 100) / 100; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  function polygonArea(poly) {
    var area = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area / 2);
  }

  function polygonCentroid(poly) {
    var cx = 0, cy = 0;
    poly.forEach(function (p) { cx += p.x; cy += p.y; });
    return { x: cx / poly.length, y: cy / poly.length };
  }

  // Sutherland-Hodgman half-plane clip: keeps the side of the line
  // through `pivot` (with the given normal) that matches `keepPositive`
  function clipHalfPlane(poly, pivot, normal, keepPositive) {
    var result = [];
    var n = poly.length;
    for (var i = 0; i < n; i++) {
      var curr = poly[i];
      var next = poly[(i + 1) % n];
      var sideCurr = dot(sub(curr, pivot), normal);
      var sideNext = dot(sub(next, pivot), normal);
      var currIn = keepPositive ? sideCurr >= 0 : sideCurr <= 0;
      var nextIn = keepPositive ? sideNext >= 0 : sideNext <= 0;
      if (currIn) result.push(curr);
      if (currIn !== nextIn && sideCurr !== sideNext) {
        var t = sideCurr / (sideCurr - sideNext);
        result.push(lerp(curr, next, t));
      }
    }
    return result;
  }

  function boundingRadius(poly, center) {
    var r = 0;
    poly.forEach(function (p) { r = Math.max(r, Math.hypot(p.x - center.x, p.y - center.y)); });
    return r;
  }

  // splits a convex polygon in two with a random straight line, pivoting
  // off-centre so pieces come out uneven rather than evenly balanced,
  // retrying with a new angle/pivot if the cut is degenerate
  function splitPolygon(poly) {
    var centroid = polygonCentroid(poly);
    var jitterRadius = boundingRadius(poly, centroid) * 0.35;
    for (var attempt = 0; attempt < 16; attempt++) {
      var jitterAngle = rand(0, Math.PI * 2);
      var jitterDist = rand(0, jitterRadius);
      var pivot = {
        x: centroid.x + Math.cos(jitterAngle) * jitterDist,
        y: centroid.y + Math.sin(jitterAngle) * jitterDist
      };
      var angle = rand(0, Math.PI);
      var normal = { x: -Math.sin(angle), y: Math.cos(angle) };
      var a = clipHalfPlane(poly, pivot, normal, true);
      var b = clipHalfPlane(poly, pivot, normal, false);
      if (a.length >= 3 && b.length >= 3 && polygonArea(a) > 1 && polygonArea(b) > 1) {
        return [a, b];
      }
    }
    return [poly];
  }

  // grows a polygon outward from its own centre so neighbouring shards
  // spill over their shared edge, like overlapping corners of paper
  function outsetPolygon(poly, amount) {
    var centroid = polygonCentroid(poly);
    return poly.map(function (p) {
      return {
        x: centroid.x + (p.x - centroid.x) * (1 + amount),
        y: centroid.y + (p.y - centroid.y) * (1 + amount)
      };
    });
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function fracture(count) {
    var polys = [
      [
        { x: 0, y: 0 },
        { x: canvasW, y: 0 },
        { x: canvasW, y: canvasH },
        { x: 0, y: canvasH }
      ]
    ];

    while (polys.length < count) {
      var largestIdx = 0;
      var largestArea = -1;
      for (var i = 0; i < polys.length; i++) {
        var a = polygonArea(polys[i]);
        if (a > largestArea) { largestArea = a; largestIdx = i; }
      }
      var pieces = splitPolygon(polys[largestIdx]);
      if (pieces.length === 1) break; // couldn't find a valid cut, stop early
      polys.splice(largestIdx, 1, pieces[0], pieces[1]);
    }
    return polys;
  }

  function polygonToPath(poly) {
    var d = "M " + fmt(poly[0].x) + " " + fmt(poly[0].y);
    for (var i = 1; i < poly.length; i++) {
      d += " L " + fmt(poly[i].x) + " " + fmt(poly[i].y);
    }
    d += " Z";
    return d;
  }

  function generateShards() {
    var count = parseInt(els.count.value, 10);
    var paletteName = els.palette.value;
    var overlap = parseInt(els.overlap.value, 10) / 100;
    var colors = PALETTES[paletteName].slice();

    var polys = fracture(count);
    shards = shuffleArray(polys.map(function (poly) {
      var color = colors.length ? colors.splice(Math.floor(Math.random() * colors.length), 1)[0] : PALETTES[paletteName][0];
      var outset = overlap > 0 ? outsetPolygon(poly, overlap * rand(0.6, 1)) : poly;
      return { path: polygonToPath(outset), color: color };
    }));
  }

  function render() {
    var opacity = parseInt(els.opacity.value, 10) / 100;
    var bg = els.bg.value;
    var crackWidth = parseInt(els.crackWidth.value, 10);
    var crackColor = els.crackColor.value;
    var shadow = els.shadow.checked;

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
      dropShadow.setAttribute("dy", fmt(Math.min(canvasW, canvasH) * 0.006));
      dropShadow.setAttribute("stdDeviation", fmt(Math.min(canvasW, canvasH) * 0.006));
      dropShadow.setAttribute("flood-color", "#000000");
      dropShadow.setAttribute("flood-opacity", "0.25");
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
    svg.appendChild(group);

    shards.forEach(function (shard) {
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", shard.path);
      path.setAttribute("fill", shard.color);
      path.setAttribute("fill-opacity", opacity);
      if (shadow) path.setAttribute("filter", "url(#sg-shadow-filter)");
      if (crackWidth > 0) {
        path.setAttribute("stroke", crackColor);
        path.setAttribute("stroke-width", crackWidth);
        path.setAttribute("stroke-linejoin", "round");
      }
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
    els.opacityValue.textContent = els.opacity.value + "%";
    els.crackWidthValue.textContent = els.crackWidth.value + "px";
    els.overlapValue.textContent = els.overlap.value + "%";
  }

  function init() {
    els.count = $("sg-count");
    els.countValue = $("sg-count-value");
    els.w = $("sg-w");
    els.h = $("sg-h");
    els.palette = $("sg-palette");
    els.opacity = $("sg-opacity");
    els.opacityValue = $("sg-opacity-value");
    els.bg = $("sg-bg");
    els.crackWidth = $("sg-crack-width");
    els.crackWidthValue = $("sg-crack-width-value");
    els.crackColor = $("sg-crack-color");
    els.overlap = $("sg-overlap");
    els.overlapValue = $("sg-overlap-value");
    els.shadow = $("sg-shadow");
    els.shuffle = $("sg-shuffle");
    els.exportPng = $("sg-export-png");
    els.exportSvg = $("sg-export-svg");
    els.stage = $("sg-stage");
    els.previewWrap = $("sg-preview-wrap");

    updateReadouts();

    els.count.addEventListener("input", function () {
      updateReadouts();
      regenerate();
    });
    els.palette.addEventListener("change", regenerate);
    els.overlap.addEventListener("input", function () {
      updateReadouts();
      regenerate();
    });
    els.shadow.addEventListener("change", render);
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
    els.crackWidth.addEventListener("input", function () {
      updateReadouts();
      render();
    });
    els.crackColor.addEventListener("input", render);
    els.bg.addEventListener("input", render);
    els.shuffle.addEventListener("click", regenerate);
    els.exportPng.addEventListener("click", exportPNG);
    els.exportSvg.addEventListener("click", exportSVG);
    window.addEventListener("resize", render);

    readCanvasSize();
    regenerate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
