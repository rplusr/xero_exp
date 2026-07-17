(function () {
  var trigger = document.getElementById("login-trigger");
  var overlay = document.getElementById("login-overlay");
  var modal = overlay ? overlay.querySelector(".login-modal") : null;
  var form = document.getElementById("login-form");
  var passwordInput = document.getElementById("login-password");
  var passwordToggle = document.getElementById("login-password-toggle");
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
    var submitBtn = form.querySelector(".login-submit");
    var original = submitBtn.textContent;
    submitBtn.textContent = "Signing in…";
    submitBtn.disabled = true;
    setTimeout(function () {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
    }, 700);
  });

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", function () {
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      passwordToggle.classList.toggle("is-visible", !showing);
    });
  }

  // light-blue border glow that strengthens the closer the pointer gets
  // to the modal's edges (0 once inside/touching, fading out over GLOW_RADIUS)
  if (modal) {
    var GLOW_RADIUS = 140;
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
      currentGlow += (targetGlow - currentGlow) * 0.15;
      modal.style.setProperty("--glow", currentGlow.toFixed(3));
      requestAnimationFrame(glowTick);
    };

    document.addEventListener("pointermove", updateTarget);
    requestAnimationFrame(glowTick);
  }
})();
