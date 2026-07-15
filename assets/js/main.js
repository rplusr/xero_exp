(function () {
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("menu-toggle");
  var overlay = document.getElementById("mobile-overlay");

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function closeOverlay() {
    overlay.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    overlay.classList.toggle("is-open", !open);
  });

  overlay.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeOverlay);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeOverlay();
  });
})();
