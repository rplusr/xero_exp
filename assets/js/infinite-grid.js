(function () {
  var host = document.getElementById("grid-host");
  if (!host) return;

  var LERP = 0.18;
  var INERTIA_DECAY = 0.94;
  var SETTLE_EPSILON = 0.05;
  var IDLE_DELAY = 1500;
  var DRIFT_X = -0.12;
  var DRIFT_Y = 0;

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

  function render() {
    host.style.backgroundPosition = curX + "px " + curY + "px";
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

  host.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  scheduleIdleDrift();
})();
