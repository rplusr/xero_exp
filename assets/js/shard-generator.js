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

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  // an irregular polygon: vertex count, radius and angle all jitter, so
  // no two shards share the same silhouette and none reads as a regular
  // shape - a rough torn-paper piece rather than a clean geometric one
  function irregularPolygon(cx, cy, avgRadius, vertexCount, irregularity, rotation) {
    var points = [];
    var angleStep = (Math.PI * 2) / vertexCount;
    for (var i = 0; i < vertexCount; i++) {
      var angle = rotation + i * angleStep + rand(-angleStep * 0.4, angleStep * 0.4);
      var radius = avgRadius * (1 + rand(-irregularity, irregularity));
      points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return points;
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
    var sizePct = parseInt(els.size.value, 10) / 100;
    var spreadPct = parseInt(els.spread.value, 10) / 100;
    var irregularity = parseInt(els.irregularity.value, 10) / 100;
    var colors = PALETTES[paletteName].slice();

    var minDim = Math.min(canvasW, canvasH);
    // at spread 0 every shard is kept fully on-canvas (centre clamped by
    // its own worst-case extent); the spread slider then allows the
    // centre to wander past that safe zone so pieces can run off an edge
    var marginX = canvasW * spreadPct;
    var marginY = canvasH * spreadPct;

    var placed = [];
    for (var i = 0; i < count; i++) {
      var radius = minDim * sizePct * rand(0.7, 1.3);
      var maxExtent = radius * (1 + irregularity);
      var cx = rand(maxExtent - marginX, canvasW - maxExtent + marginX);
      var cy = rand(maxExtent - marginY, canvasH - maxExtent + marginY);
      var vertexCount = Math.floor(rand(4, 8));
      var rotation = rand(0, Math.PI * 2);
      var poly = irregularPolygon(cx, cy, radius, vertexCount, irregularity, rotation);
      var color = colors.length ? colors.splice(Math.floor(Math.random() * colors.length), 1)[0] : pick(PALETTES[paletteName]);
      placed.push({ path: polygonToPath(poly), color: color });
    }
    shards = shuffleArray(placed);
  }

  function render() {
    var opacity = parseInt(els.opacity.value, 10) / 100;
    var bg = els.bg.value;

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);
    svg.setAttribute("viewBox", "0 0 " + canvasW + " " + canvasH);

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

  function serializeStageSVG() {
    var svg = els.stage.querySelector("svg");
    return new XMLSerializer().serializeToString(svg);
  }

  // downloads are unreliable inside a sandboxed preview iframe (the
  // <a download> attribute and window.open popups can both be silently
  // blocked), so exporting always opens an in-page modal instead: a real
  // download link (works when the browser allows it) plus a visible
  // preview/textarea the file can always be saved or copied from by hand
  function openExportModal(kind, dataUrl, filename, svgText) {
    els.exportHint.textContent =
      kind === "svg"
        ? "Use the download button, or select all and copy the code below into a .svg file."
        : "Use the download button, or right-click the image and choose “Save image as…”.";
    els.exportPreview.innerHTML = "";

    if (kind === "png") {
      var img = document.createElement("img");
      img.src = dataUrl;
      img.alt = filename;
      els.exportPreview.appendChild(img);
    } else {
      var textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = svgText;
      els.exportPreview.appendChild(textarea);
      textarea.focus();
      textarea.select();
    }

    els.exportDownload.href = dataUrl;
    els.exportDownload.download = filename;
    els.exportModal.classList.add("is-open");
    els.exportModal.setAttribute("aria-hidden", "false");
  }

  function closeExportModal() {
    els.exportModal.classList.remove("is-open");
    els.exportModal.setAttribute("aria-hidden", "true");
  }

  function exportSVG() {
    var svgText = serializeStageSVG();
    var dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    openExportModal("svg", dataUrl, "xero-shards-" + canvasW + "x" + canvasH + ".svg", svgText);
  }

  function exportPNG() {
    var svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serializeStageSVG());
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      openExportModal("png", canvas.toDataURL("image/png"), "xero-shards-" + canvasW + "x" + canvasH + ".png");
    };
    img.src = svgDataUrl;
  }

  function updateReadouts() {
    els.countValue.textContent = els.count.value;
    els.opacityValue.textContent = els.opacity.value + "%";
    els.sizeValue.textContent = els.size.value + "%";
    els.spreadValue.textContent = els.spread.value + "%";
    els.irregularityValue.textContent = els.irregularity.value + "%";
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
    els.size = $("sg-size");
    els.sizeValue = $("sg-size-value");
    els.spread = $("sg-spread");
    els.spreadValue = $("sg-spread-value");
    els.irregularity = $("sg-irregularity");
    els.irregularityValue = $("sg-irregularity-value");
    els.shuffle = $("sg-shuffle");
    els.exportPng = $("sg-export-png");
    els.exportSvg = $("sg-export-svg");
    els.stage = $("sg-stage");
    els.previewWrap = $("sg-preview-wrap");
    els.exportModal = $("sg-export-modal");
    els.exportClose = $("sg-export-close");
    els.exportHint = $("sg-export-hint");
    els.exportPreview = $("sg-export-preview");
    els.exportDownload = $("sg-export-download");

    updateReadouts();

    [els.count, els.size, els.spread, els.irregularity].forEach(function (input) {
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
    els.shuffle.addEventListener("click", regenerate);
    els.exportPng.addEventListener("click", exportPNG);
    els.exportSvg.addEventListener("click", exportSVG);
    els.exportClose.addEventListener("click", closeExportModal);
    els.exportModal.addEventListener("click", function (e) {
      if (e.target === els.exportModal) closeExportModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeExportModal();
    });
    window.addEventListener("resize", render);

    readCanvasSize();
    regenerate();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
