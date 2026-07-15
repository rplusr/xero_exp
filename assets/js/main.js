(function () {
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("menu-toggle");
  var overlay = document.getElementById("mobile-overlay");
  var navItems = document.querySelectorAll(".nav-item");
  var megaPanel = document.getElementById("mega-panel");
  var closeTimer = null;

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

  function openMega(item) {
    clearTimeout(closeTimer);
    navItems.forEach(function (i) {
      i.classList.remove("is-open");
      i.querySelector(".nav-link").setAttribute("aria-expanded", "false");
    });
    item.classList.add("is-open");
    item.querySelector(".nav-link").setAttribute("aria-expanded", "true");
    megaPanel.classList.add("is-open");
  }

  function scheduleCloseMega() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      navItems.forEach(function (i) {
        i.classList.remove("is-open");
        i.querySelector(".nav-link").setAttribute("aria-expanded", "false");
      });
      megaPanel.classList.remove("is-open");
    }, 150);
  }

  navItems.forEach(function (item) {
    item.addEventListener("mouseenter", function () { openMega(item); });
    item.addEventListener("mouseleave", scheduleCloseMega);
    item.addEventListener("focusin", function () { openMega(item); });
    item.addEventListener("focusout", scheduleCloseMega);
  });

  megaPanel.addEventListener("mouseenter", function () { clearTimeout(closeTimer); });
  megaPanel.addEventListener("mouseleave", scheduleCloseMega);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeOverlay();
      navItems.forEach(function (i) {
        i.classList.remove("is-open");
        i.querySelector(".nav-link").setAttribute("aria-expanded", "false");
      });
      megaPanel.classList.remove("is-open");
    }
  });
})();
