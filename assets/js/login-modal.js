(function () {
  var trigger = document.getElementById("login-trigger");
  var overlay = document.getElementById("login-overlay");
  var modal = overlay ? overlay.querySelector(".login-modal") : null;
  var form = document.getElementById("login-form");
  var passwordInput = document.getElementById("login-password");
  var passwordToggle = document.getElementById("login-password-toggle");
  var submitBtn = document.getElementById("login-submit");
  var submitLabel = submitBtn ? submitBtn.querySelector(".login-submit-label") : null;
  if (!overlay || !form) return;

  // this modal is the site's splash gate, not a dismissible dialog —
  // it stays on screen; there's no backdrop/escape/close-button dismissal
  if (trigger) {
    trigger.addEventListener("click", function () {
      var firstInput = form.querySelector("input");
      if (firstInput) firstInput.focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!submitBtn || submitBtn.disabled) return;
    var original = submitLabel.textContent;
    submitBtn.disabled = true;
    submitLabel.textContent = "Signing in…";
    setTimeout(function () {
      // stubbed: every submission succeeds for now, no real auth backend
      submitBtn.classList.add("is-success");
      setTimeout(function () {
        submitBtn.classList.remove("is-success");
        submitLabel.textContent = original;
        submitBtn.disabled = false;
      }, 1400);
    }, 500);
  });

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", function () {
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      passwordToggle.classList.toggle("is-visible", !showing);
    });
  }

  // light-blue border glow that brightens the closer the pointer gets to
  // the modal's edges (0 once inside/touching, fading out over GLOW_RADIUS)
  if (modal) {
    var GLOW_RADIUS = 220;
    var targetGlow = 0;
    var currentGlow = 0;

    var updateTarget = function (e) {
      var rect = modal.getBoundingClientRect();
      var dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      var dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      var dist = Math.sqrt(dx * dx + dy * dy);
      targetGlow = Math.max(0, 1 - dist / GLOW_RADIUS);
    };

    var glowTick = function () {
      currentGlow += (targetGlow - currentGlow) * 0.25;
      modal.style.setProperty("--glow", currentGlow.toFixed(3));
      requestAnimationFrame(glowTick);
    };

    document.addEventListener("pointermove", updateTarget);
    requestAnimationFrame(glowTick);
  }
})();
