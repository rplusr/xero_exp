(function () {
  var trigger = document.getElementById("login-trigger");
  var overlay = document.getElementById("login-overlay");
  var form = document.getElementById("login-form");
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
})();
