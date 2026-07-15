(function () {
  var host = document.getElementById("grid-host");
  var warp = document.getElementById("grid-warp");
  if (!host || !warp) return;

  var LERP = 0.18;
  var INERTIA_DECAY = 0.94;
  var SETTLE_EPSILON = 0.05;
  var IDLE_DELAY = 1500;
  var DRIFT_X = -0.12;
  var DRIFT_Y = 0;
  // facet size matches the montage's own repeat cell (see torus-grid.png /
  // build_charms_montage.py "cell") so seams land in the gaps between icons
  // rather than cutting through one, at any pan offset
  var MONTAGE_CELL = 160;
  var MAX_ANGLE = 32;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var targetX = 0;
  var targetY = 0;
  var curX = 0;
  var curY = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var velX = 0;
  var velY = 0;
  var animating = false;
  var autoDrift = false;
  var idleTimer = null;
  var tiles = [];
  var resizeTimer = null;

  function buildTiles() {
    var w = host.clientWidth;
    var h = host.clientHeight;
    var cols = Math.ceil(w / MONTAGE_CELL);
    var rows = Math.ceil(h / MONTAGE_CELL);
    var totalCols = cols + 1;
    var totalRows = rows + 1;

    warp.innerHTML = "";
    tiles = [];

    // one extra column/row of buffer (slot -1) covers the gap the
    // fractional pan shift reveals at the top/left edge
    for (var r = -1; r < rows; r++) {
      for (var c = -1; c < cols; c++) {
        var tile = document.createElement("div");
        tile.className = "grid-tile";
        var slotLeft = c * MONTAGE_CELL;
        var slotTop = r * MONTAGE_CELL;
        tile.style.width = MONTAGE_CELL + "px";
        tile.style.height = MONTAGE_CELL + "px";

        var nx = (c + 1 + 0.5) / totalCols - 0.5;
        var ny = (r + 1 + 0.5) / totalRows - 0.5;
        var rotY = nx * MAX_ANGLE;
        var rotX = -ny * MAX_ANGLE;
        tile.style.transform = "rotateX(" + rotX + "deg) rotateY(" + rotY + "deg)";

        warp.appendChild(tile);
        tiles.push({ el: tile, slotLeft: slotLeft, slotTop: slotTop });
      }
    }
  }

  function render() {
    var fracX = ((curX % MONTAGE_CELL) + MONTAGE_CELL) % MONTAGE_CELL;
    var fracY = ((curY % MONTAGE_CELL) + MONTAGE_CELL) % MONTAGE_CELL;
    var wholeX = curX - fracX;
    var wholeY = curY - fracY;

    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i];
      t.el.style.left = (t.slotLeft + fracX) + "px";
      t.el.style.top = (t.slotTop + fracY) + "px";
      t.el.style.backgroundPosition = (wholeX - t.slotLeft) + "px " + (wholeY - t.slotTop) + "px";
    }
  }

  function tick() {
    if (!dragging && (velX !== 0 || velY !== 0)) {
      targetX += velX;
      targetY += velY;
      velX *= INERTIA_DECAY;
      velY *= INERTIA_DECAY;
      if (Math.abs(velX) < 0.02) velX = 0;
      if (Math.abs(velY) < 0.02) velY = 0;
    }

    if (!dragging && autoDrift && velX === 0 && velY === 0) {
      targetX += DRIFT_X;
      targetY += DRIFT_Y;
    }

    if (reduceMotion) {
      curX = targetX;
      curY = targetY;
    } else {
      curX += (targetX - curX) * LERP;
      curY += (targetY - curY) * LERP;
    }
    render();

    var settled = Math.abs(targetX - curX) < SETTLE_EPSILON && Math.abs(targetY - curY) < SETTLE_EPSILON;
    if (dragging || velX !== 0 || velY !== 0 || autoDrift || !settled) {
      requestAnimationFrame(tick);
    } else {
      animating = false;
    }
  }

  function ensureAnimating() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  function scheduleIdleDrift() {
    if (reduceMotion) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      autoDrift = true;
      ensureAnimating();
    }, IDLE_DELAY);
  }

  function stopIdleDrift() {
    clearTimeout(idleTimer);
    autoDrift = false;
  }

  function onDown(e) {
    stopIdleDrift();
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = velY = 0;
    host.classList.add("is-dragging");
    if (host.setPointerCapture) host.setPointerCapture(e.pointerId);
    ensureAnimating();
  }

  function onMove(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    targetX += dx;
    targetY += dy;
    velX = dx;
    velY = dy;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onUp() {
    dragging = false;
    host.classList.remove("is-dragging");
    if (reduceMotion) velX = velY = 0;
    scheduleIdleDrift();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      buildTiles();
      render();
    }, 150);
  }

  host.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", onResize);

  buildTiles();
  render();
  scheduleIdleDrift();
})();
