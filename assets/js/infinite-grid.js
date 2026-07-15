(function () {
  var host = document.getElementById("grid-host");
  if (!host) return;

  // must match the montage's intrinsic size (see torus-grid.svg / gen script)
  var TILE_W = 1400;
  var TILE_H = 560;
  var INERTIA_DECAY = 0.94;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var posX = 0;
  var posY = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var velX = 0;
  var velY = 0;

  function applyPosition() {
    posX = ((posX % TILE_W) + TILE_W) % TILE_W;
    posY = ((posY % TILE_H) + TILE_H) % TILE_H;
    host.style.backgroundPosition = posX + "px " + posY + "px";
  }

  function onDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = velY = 0;
    host.classList.add("is-dragging");
    if (host.setPointerCapture) host.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    posX += dx;
    posY += dy;
    velX = dx;
    velY = dy;
    lastX = e.clientX;
    lastY = e.clientY;
    applyPosition();
  }

  function onUp() {
    dragging = false;
    host.classList.remove("is-dragging");
    if (reduceMotion) {
      velX = velY = 0;
    }
  }

  host.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  function loop() {
    if (!dragging && (velX !== 0 || velY !== 0)) {
      posX += velX;
      posY += velY;
      velX *= INERTIA_DECAY;
      velY *= INERTIA_DECAY;
      if (Math.abs(velX) < 0.02) velX = 0;
      if (Math.abs(velY) < 0.02) velY = 0;
      applyPosition();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
