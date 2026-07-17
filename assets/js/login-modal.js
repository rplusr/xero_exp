(function () {
  var trigger = document.getElementById("login-trigger");
  var overlay = document.getElementById("login-overlay");
  var closeBtn = document.getElementById("login-close");
  var form = document.getElementById("login-form");
  if (!trigger || !overlay || !form) return;

  function openModal() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    var firstInput = form.querySelector("input");
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    trigger.focus();
  }

  trigger.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var submitBtn = form.querySelector(".login-submit");
    var original = submitBtn.textContent;
    submitBtn.textContent = "Signing in…";
    submitBtn.disabled = true;
    setTimeout(function () {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
      closeModal();
      form.reset();
    }, 700);
  });
})();
