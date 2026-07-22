(function () {
  var NS = "http://www.w3.org/2000/svg";

  var FONTS = {
    "condensed-bold": { family: "National 2 Condensed", weight: 700, file: "national-2-condensed-bold.woff2" },
    "bold": { family: "National 2", weight: 700, file: "national-2-web-bold.woff2" },
    "regular": { family: "National 2", weight: 400, file: "national-2-web-regular.woff2" }
  };

  var PRESETS = [
    ["#13B5EA", "#000856"], // signal — accent core, navy out
    ["#000856", "#13B5EA"], // reversed — navy core, accent out
    ["#1A1A1A", "#6B7280"]  // mono — ink core, muted out
  ];

  var PLATE_HEX = { paper: "#FFFFFF", navy: "#000856" };

  var state = {
    text: "Xero",
    font: "condensed-bold",
    size: 220,
    tracking: 0,
    weight: 3,
    interval: 6,
    layers: 5,
    fillCenter: false,
    bg: "paper",
    bgCustom: "#F4F6F8",
    preset: 0
  };

  var userColors = {};
  var capRatioCache = {};

  var svg = document.getElementById("tf-svg");
  var canvas = document.getElementById("tf-canvas");
  var form = document.getElementById("tf-form");
  var swatchRow = document.getElementById("tf-swatches");
  var dimsEl = document.getElementById("tf-dims");
  var layerCountEl = document.getElementById("tf-layer-count");
  var bgCustomRow = document.getElementById("tf-bg-custom-row");

  function hexToRgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    var num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (v) {
      return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
    }).join("");
  }

  function lerpColor(c1, c2, t) {
    var a = hexToRgb(c1), b = hexToRgb(c2);
    return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }

  function paletteColors(n) {
    var pair = PRESETS[state.preset % PRESETS.length];
    var arr = [];
    for (var i = 0; i < n; i++) {
      var t = n <= 1 ? 0 : i / (n - 1);
      arr.push(lerpColor(pair[0], pair[1], t));
    }
    return arr;
  }

  function getColors(n) {
    return paletteColors(n).map(function (c, i) {
      return userColors[i] || c;
    });
  }

  function measureCapRatio(key) {
    if (capRatioCache[key]) return capRatioCache[key];
    var font = FONTS[key];
    var tmp = document.createElementNS(NS, "svg");
    tmp.setAttribute("width", "0");
    tmp.setAttribute("height", "0");
    tmp.style.position = "absolute";
    tmp.style.visibility = "hidden";
    var t = document.createElementNS(NS, "text");
    t.setAttribute("x", 0);
    t.setAttribute("y", 0);
    t.setAttribute("font-family", font.family);
    t.setAttribute("font-weight", String(font.weight));
    t.setAttribute("font-size", "200");
    t.textContent = "H";
    tmp.appendChild(t);
    document.body.appendChild(tmp);
    var ratio = 0.72;
    try {
      var bbox = t.getBBox();
      if (bbox.height > 0) ratio = bbox.height / 200;
    } catch (e) {}
    document.body.removeChild(tmp);
    capRatioCache[key] = ratio;
    return ratio;
  }

  function renderSVG() {
    var font = FONTS[state.font];
    var capRatio = measureCapRatio(state.font);
    var fontSize = state.size / capRatio;
    var text = (state.text || "").toUpperCase().trim() || " ";
    var n = state.layers;
    var colors = getColors(n);

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    for (var i = n - 1; i >= 0; i--) {
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", 0);
      t.setAttribute("y", 0);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("dominant-baseline", "central");
      t.setAttribute("font-family", font.family);
      t.setAttribute("font-weight", String(font.weight));
      t.setAttribute("font-size", String(fontSize));
      t.setAttribute("letter-spacing", String(state.tracking));
      var sw = state.weight + 2 * i * state.interval;
      if (i === 0 && state.fillCenter) {
        t.setAttribute("fill", colors[0]);
        t.setAttribute("stroke", "none");
      } else {
        t.setAttribute("fill", "none");
        t.setAttribute("stroke", colors[i]);
        t.setAttribute("stroke-width", String(Math.max(sw, 0.01)));
        t.setAttribute("stroke-linejoin", "round");
        t.setAttribute("stroke-linecap", "round");
      }
      t.textContent = text;
      svg.appendChild(t);
    }

    requestAnimationFrame(function () {
      var bbox;
      try { bbox = svg.getBBox(); } catch (e) { return; }
      if (!bbox || (bbox.width === 0 && bbox.height === 0)) return;
      var outerPad = state.weight / 2 + Math.max(0, n - 1) * state.interval + 24;
      var x = bbox.x - outerPad, y = bbox.y - outerPad;
      var w = bbox.width + outerPad * 2, h = bbox.height + outerPad * 2;
      svg.setAttribute("viewBox", x + " " + y + " " + w + " " + h);
      dimsEl.textContent = Math.round(w) + " × " + Math.round(h) + " px";
    });

    layerCountEl.textContent = n + (n === 1 ? " layer" : " layers");
  }

  function rebuildSwatches() {
    var n = state.layers;
    var colors = getColors(n);
    swatchRow.innerHTML = "";
    for (var i = 0; i < n; i++) {
      (function (i) {
        var wrap = document.createElement("div");
        wrap.className = "tf-swatch";

        var input = document.createElement("input");
        input.type = "color";
        input.className = "tf-color";
        input.value = colors[i];
        input.setAttribute("aria-label", i === 0 ? "Core layer colour" : "Layer " + i + " colour");
        input.addEventListener("input", function (e) {
          userColors[i] = e.target.value;
          renderSVG();
        });

        var label = document.createElement("span");
        label.className = "tf-swatch-index";
        label.textContent = i === 0 ? "core" : String(i);

        wrap.appendChild(input);
        wrap.appendChild(label);
        swatchRow.appendChild(wrap);
      })(i);
    }
  }

  function applyPlate() {
    canvas.setAttribute("data-plate", state.bg);
    canvas.style.setProperty("--tf-plate-custom", state.bgCustom);
    bgCustomRow.hidden = state.bg !== "custom";
  }

  function bindNumeric(id, outId, key, parse) {
    var input = document.getElementById(id);
    var out = outId ? document.getElementById(outId) : null;
    input.addEventListener("input", function () {
      state[key] = parse(input.value);
      if (out) out.textContent = input.value;
      renderSVG();
    });
  }

  document.getElementById("tf-text").addEventListener("input", function (e) {
    state.text = e.target.value;
    renderSVG();
  });

  document.getElementById("tf-font").addEventListener("change", function (e) {
    state.font = e.target.value;
    renderSVG();
  });

  bindNumeric("tf-size", "tf-size-val", "size", Number);
  bindNumeric("tf-tracking", "tf-tracking-val", "tracking", Number);
  bindNumeric("tf-weight", "tf-weight-val", "weight", Number);
  bindNumeric("tf-interval", "tf-interval-val", "interval", Number);

  document.getElementById("tf-layers").addEventListener("input", function (e) {
    state.layers = Number(e.target.value);
    document.getElementById("tf-layers-val").textContent = e.target.value;
    rebuildSwatches();
    renderSVG();
  });

  document.getElementById("tf-fill").addEventListener("change", function (e) {
    state.fillCenter = e.target.checked;
    renderSVG();
  });

  document.getElementById("tf-bg").addEventListener("change", function (e) {
    state.bg = e.target.value;
    applyPlate();
  });

  document.getElementById("tf-bg-custom").addEventListener("input", function (e) {
    state.bgCustom = e.target.value;
    applyPlate();
  });

  document.getElementById("tf-preset-cycle").addEventListener("click", function () {
    state.preset = (state.preset + 1) % PRESETS.length;
    userColors = {};
    rebuildSwatches();
    renderSVG();
  });

  form.addEventListener("submit", function (e) { e.preventDefault(); });

  function arrayBufferToBase64(buf) {
    var binary = "";
    var bytes = new Uint8Array(buf);
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  document.getElementById("tf-export").addEventListener("click", function () {
    var btn = this;
    var label = btn.querySelector("span");
    var originalLabel = label.textContent;
    label.textContent = "Exporting…";
    btn.disabled = true;

    var font = FONTS[state.font];
    fetch("assets/fonts/" + font.file)
      .then(function (res) { return res.arrayBuffer(); })
      .then(function (buf) {
        var b64 = arrayBufferToBase64(buf);
        var viewBox = svg.getAttribute("viewBox") || "0 0 400 400";
        var parts = viewBox.split(" ").map(Number);

        var clone = svg.cloneNode(true);
        clone.setAttribute("xmlns", NS);
        clone.setAttribute("viewBox", viewBox);
        clone.setAttribute("width", parts[2]);
        clone.setAttribute("height", parts[3]);

        var defs = document.createElementNS(NS, "defs");
        var style = document.createElementNS(NS, "style");
        style.textContent = "@font-face{font-family:'" + font.family + "';font-weight:" + font.weight +
          ";src:url(data:font/woff2;base64," + b64 + ") format('woff2');}";
        defs.appendChild(style);
        clone.insertBefore(defs, clone.firstChild);

        if (state.bg !== "transparent") {
          var fill = state.bg === "custom" ? state.bgCustom : (PLATE_HEX[state.bg] || "#FFFFFF");
          var rect = document.createElementNS(NS, "rect");
          rect.setAttribute("x", parts[0]);
          rect.setAttribute("y", parts[1]);
          rect.setAttribute("width", parts[2]);
          rect.setAttribute("height", parts[3]);
          rect.setAttribute("fill", fill);
          clone.insertBefore(rect, defs.nextSibling);
        }

        var xml = new XMLSerializer().serializeToString(clone);
        var full = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
        var blob = new Blob([full], { type: "image/svg+xml" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var slug = (state.text || "typeface").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        a.href = url;
        a.download = (slug || "typeface") + "-stroke-offset.svg";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(function (err) {
        console.error("SVG export failed:", err);
      })
      .finally(function () {
        label.textContent = originalLabel;
        btn.disabled = false;
      });
  });

  function init() {
    applyPlate();
    rebuildSwatches();
    renderSVG();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init).catch(init);
  } else {
    init();
  }
})();
