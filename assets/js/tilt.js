(function () {
  var btn = document.getElementById("tilt-permission-btn");
  var label = btn ? btn.querySelector(".tilt-btn-label") : null;
  if (!btn || !label) return;

  var isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var supported = isTouch && typeof window.DeviceOrientationEvent !== "undefined";
  if (!supported) {
    btn.parentNode.removeChild(btn);
    return;
  }

  // iOS 13+ requires DeviceOrientationEvent.requestPermission() to be
  // called from a user gesture before any events will fire; other
  // platforms just start delivering events once a listener is attached
  var MAX_TILT_DEG = 35;
  var GRAVITY_BASE = 0.6;
  var calibrated = false;
  var baseBeta = 0;
  var baseGamma = 0;
  var receivedEvent = false;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function onOrientation(e) {
    if (e.beta === null || e.gamma === null) return;
    receivedEvent = true;

    if (!calibrated) {
      // calibrate against however the phone happens to be held, so
      // tilting relative to that starting position is what drives
      // gravity rather than the raw absolute device angle
      baseBeta = e.beta;
      baseGamma = e.gamma;
      calibrated = true;
      return;
    }

    var dGamma = clamp((e.gamma - baseGamma) / MAX_TILT_DEG, -1, 1);
    var dBeta = clamp((e.beta - baseBeta) / MAX_TILT_DEG, -1, 1);
    window.__ballpitGravity = {
      x: dGamma * GRAVITY_BASE,
      y: GRAVITY_BASE + dBeta * GRAVITY_BASE
    };
  }

  function enable() {
    window.addEventListener("deviceorientation", onOrientation);
    label.textContent = "Tilt enabled";
    btn.classList.add("is-active");
    setTimeout(function () {
      if (receivedEvent) {
        btn.classList.add("is-hidden");
      } else {
        label.textContent = "Tilt unavailable";
        btn.disabled = true;
      }
    }, 1500);
  }

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then(function (result) {
          if (result === "granted") {
            enable();
          } else {
            label.textContent = "Tilt denied";
            btn.disabled = true;
          }
        })
        .catch(function () {
          label.textContent = "Tilt unavailable";
          btn.disabled = true;
        });
    } else {
      enable();
    }
  });
})();
