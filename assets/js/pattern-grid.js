(function () {
  var TILE_UNIT = 297; // native px of one grid cell in the source SVGs
  var SQUARE_TILES = ["square-1", "square-2", "square-3", "square-4", "square-5", "square-6", "square-7"];
  var WIDE_TILES = ["wide-1", "wide-2", "wide-3", "wide-4", "wide-5", "wide-6", "wide-7"];
  var TILE_DIR = "assets/img/pattern-tiles/";

  var PRESETS = [
    { label: "Custom", w: null, h: null },
    { label: "Desktop / 1920 × 1080", w: 1920, h: 1080 },
    { label: "Facebook post / 1200 × 630", w: 1200, h: 630 },
    { label: "Facebook cover / 820 × 312", w: 820, h: 312 },
    { label: "Instagram post / 1080 × 1350", w: 1080, h: 1350 },
    { label: "Instagram story / 1080 × 1920", w: 1080, h: 1920 }
  ];

  var els = {};
  var tiles = {}; // name -> { img, svgText, vbW, vbH }
  var layout = []; // placed tiles, in true (unscaled) pixel space
  var idCounter = 0;
  var canvasW = 1920, canvasH = 1080;

  function $(id) { return document.getElementById(id); }

  function loadTile(name) {
    return fetch(TILE_DIR + name + ".svg")
      .then(function (r) { return r.text(); })
      .then(function (text) {
        var wm = /width="([\d.]+)"/.exec(text);
        var hm = /height="([\d.]+)"/.exec(text);
        var blob = new Blob([text], { type: "image/svg+xml" });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.src = url;
        return new Promise(function (resolve) {
          img.onload = function () {
            tiles[name] = {
              img: img,
              svgText: text,
              vbW: wm ? parseFloat(wm[1]) : TILE_UNIT,
              vbH: hm ? parseFloat(hm[1]) : TILE_UNIT
            };
            resolve();
          };
        });
      });
  }

  function loadAllTiles() {
    var names = SQUARE_TILES.concat(WIDE_TILES);
    return Promise.all(names.map(loadTile));
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildLayout() {
    var cellPx = parseInt(els.scale.value, 10);
    var wideFreq = parseInt(els.wideFreq.value, 10) / 100;
    var allowRotate = els.rotate.checked;
    var allowFlip = els.flip.checked;

    // bleed one extra cell of tiles on every side so the frame edges are
    // always flush, regardless of how the canvas size divides by cellPx
    var cols = Math.ceil(canvasW / cellPx) + 2;
    var rows = Math.ceil(canvasH / cellPx) + 2;
    var offsetX = -cellPx;
    var offsetY = -cellPx;

    var occupied = [];
    for (var r = 0; r < rows; r++) occupied.push(new Array(cols).fill(false));

    layout = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (occupied[r][c]) continue;
        var canWide = c + 1 < cols && !occupied[r][c + 1] && Math.random() < wideFreq;
        var w = canWide ? 2 : 1;
        var h = 1;
        occupied[r][c] = true;
        if (canWide) occupied[r][c + 1] = true;

        var name = canWide ? pick(WIDE_TILES) : pick(SQUARE_TILES);
        var rotation = 0;
        if (allowRotate) {
          rotation = canWide ? pick([0, 180]) : pick([0, 90, 180, 270]);
        }
        var flipX = allowFlip && Math.random() < 0.5;
        var flipY = allowFlip && Math.random() < 0.5;

        layout.push({
          id: idCounter++,
          col: c, row: r, w: w, h: h,
          x: offsetX + c * cellPx,
          y: offsetY + r * cellPx,
          px: cellPx * w, py: cellPx * h,
          name: name, rotation: rotation, flipX: flipX, flipY: flipY,
          wide: canWide
        });
      }
    }
  }

  function rerollTile(tile) {
    tile.name = tile.wide ? pick(WIDE_TILES) : pick(SQUARE_TILES);
    if (els.rotate.checked) {
      tile.rotation = tile.wide ? pick([0, 180]) : pick([0, 90, 180, 270]);
    }
    if (els.flip.checked) {
      tile.flipX = Math.random() < 0.5;
      tile.flipY = Math.random() < 0.5;
    }
  }

  function renderPreview() {
    var stage = els.stage;
    stage.innerHTML = "";

    var wrap = els.previewWrap;
    var maxW = wrap.clientWidth;
    var maxH = wrap.clientHeight;
    var scale = Math.min(maxW / canvasW, maxH / canvasH, 1);

    stage.style.width = canvasW + "px";
    stage.style.height = canvasH + "px";
    stage.style.transform = "scale(" + scale + ")";

    layout.forEach(function (t) {
      var tile = tiles[t.name];
      if (!tile) return;
      var div = document.createElement("div");
      div.className = "pgg-tile";
      div.style.left = t.x + "px";
      div.style.top = t.y + "px";
      div.style.width = t.px + "px";
      div.style.height = t.py + "px";
      div.title = "Click to reroll this tile";

      var img = document.createElement("img");
      img.src = tile.img.src;
      img.draggable = false;
      var transforms = [];
      if (t.rotation) transforms.push("rotate(" + t.rotation + "deg)");
      if (t.flipX) transforms.push("scaleX(-1)");
      if (t.flipY) transforms.push("scaleY(-1)");
      img.style.transform = transforms.join(" ");
      div.appendChild(img);

      div.addEventListener("click", function () {
        rerollTile(t);
        renderPreview();
      });

      stage.appendChild(div);
    });
  }

  function regenerate() {
    buildLayout();
    renderPreview();
  }

  function applyPreset() {
    var idx = parseInt(els.preset.value, 10);
    var preset = PRESETS[idx];
    if (preset.w) {
      els.customW.value = preset.w;
      els.customH.value = preset.h;
    }
    canvasW = parseInt(els.customW.value, 10) || 1920;
    canvasH = parseInt(els.customH.value, 10) || 1080;
    els.dims.textContent = canvasW + " × " + canvasH + "px";
    regenerate();
  }

  function drawExportCanvas() {
    var canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = els.bg.value;
    ctx.fillRect(0, 0, canvasW, canvasH);

    layout.forEach(function (t) {
      var tile = tiles[t.name];
      if (!tile) return;
      ctx.save();
      ctx.translate(t.x + t.px / 2, t.y + t.py / 2);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
      ctx.drawImage(tile.img, -t.px / 2, -t.py / 2, t.px, t.py);
      ctx.restore();
    });

    return canvas;
  }

  function exportPNG() {
    var canvas = drawExportCanvas();
    canvas.toBlob(function (blob) {
      downloadBlob(blob, "xero-pattern-grid-" + canvasW + "x" + canvasH + ".png");
    }, "image/png");
  }

  function namespaceIds(svgText, suffix) {
    var idMap = {};
    svgText.replace(/\bid="([^"]+)"/g, function (m, id) {
      idMap[id] = id + "-" + suffix;
      return m;
    });
    var out = svgText;
    Object.keys(idMap).forEach(function (id) {
      var esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out
        .replace(new RegExp('id="' + esc + '"', "g"), 'id="' + idMap[id] + '"')
        .replace(new RegExp("url\\(#" + esc + "\\)", "g"), "url(#" + idMap[id] + ")");
    });
    return out;
  }

  function innerSvgMarkup(svgText) {
    var m = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svgText);
    return m ? m[1] : "";
  }

  function exportSVG() {
    var parts = [];
    parts.push(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + canvasW + '" height="' + canvasH +
      '" viewBox="0 0 ' + canvasW + " " + canvasH + '">'
    );
    parts.push('<rect width="' + canvasW + '" height="' + canvasH + '" fill="' + els.bg.value + '"/>');
    parts.push('<clipPath id="pgg-frame"><rect x="0" y="0" width="' + canvasW + '" height="' + canvasH + '"/></clipPath>');
    parts.push('<g clip-path="url(#pgg-frame)">');

    layout.forEach(function (t) {
      var tile = tiles[t.name];
      if (!tile) return;
      var cx = t.x + t.px / 2;
      var cy = t.y + t.py / 2;
      var sx = t.flipX ? -1 : 1;
      var sy = t.flipY ? -1 : 1;
      var transform =
        "translate(" + t.x + " " + t.y + ") " +
        "translate(" + t.px / 2 + " " + t.py / 2 + ") " +
        "rotate(" + t.rotation + ") " +
        "scale(" + sx + " " + sy + ") " +
        "translate(" + -t.px / 2 + " " + -t.py / 2 + ")";
      var scaleX = t.px / tile.vbW;
      var scaleY = t.py / tile.vbH;
      var suffix = "i" + t.id;
      var inner = namespaceIds(innerSvgMarkup(tile.svgText), suffix);

      parts.push('<g transform="' + transform + '">');
      parts.push('<g transform="scale(' + scaleX + " " + scaleY + ')">');
      parts.push(inner);
      parts.push("</g></g>");
    });

    parts.push("</g></svg>");

    var blob = new Blob([parts.join("\n")], { type: "image/svg+xml" });
    downloadBlob(blob, "xero-pattern-grid-" + canvasW + "x" + canvasH + ".svg");
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

  function init() {
    els.preset = $("pgg-preset");
    els.customW = $("pgg-w");
    els.customH = $("pgg-h");
    els.scale = $("pgg-scale");
    els.scaleValue = $("pgg-scale-value");
    els.wideFreq = $("pgg-wide-freq");
    els.wideFreqValue = $("pgg-wide-freq-value");
    els.rotate = $("pgg-rotate");
    els.flip = $("pgg-flip");
    els.bg = $("pgg-bg");
    els.dims = $("pgg-dims");
    els.stage = $("pgg-stage");
    els.previewWrap = $("pgg-preview-wrap");
    els.shuffle = $("pgg-shuffle");
    els.exportPng = $("pgg-export-png");
    els.exportSvg = $("pgg-export-svg");

    PRESETS.forEach(function (p, i) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = p.label;
      els.preset.appendChild(opt);
    });
    els.preset.value = 1; // default to 1920x1080

    els.scaleValue.textContent = els.scale.value + "px";
    els.wideFreqValue.textContent = els.wideFreq.value + "%";

    els.preset.addEventListener("change", applyPreset);
    [els.customW, els.customH].forEach(function (input) {
      input.addEventListener("change", function () {
        els.preset.value = 0;
        applyPreset();
      });
    });
    els.scale.addEventListener("input", function () {
      els.scaleValue.textContent = els.scale.value + "px";
      regenerate();
    });
    els.wideFreq.addEventListener("input", function () {
      els.wideFreqValue.textContent = els.wideFreq.value + "%";
      regenerate();
    });
    els.rotate.addEventListener("change", regenerate);
    els.flip.addEventListener("change", regenerate);
    els.bg.addEventListener("input", renderPreview);
    els.shuffle.addEventListener("click", regenerate);
    els.exportPng.addEventListener("click", exportPNG);
    els.exportSvg.addEventListener("click", exportSVG);
    window.addEventListener("resize", renderPreview);

    loadAllTiles().then(function () {
      applyPreset();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
