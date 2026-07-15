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
    header.classList.add("mega-open");
  }

  function scheduleCloseMega() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      navItems.forEach(function (i) {
        i.classList.remove("is-open");
        i.querySelector(".nav-link").setAttribute("aria-expanded", "false");
      });
      megaPanel.classList.remove("is-open");
      header.classList.remove("mega-open");
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
      header.classList.remove("mega-open");
    }
  });

  // scramble reveal, adapted from kinetics (github.com/ckissi/kinetics)
  // restricted to digits per the brand's tabular-numeral convention
  var SCRAMBLE_CHARS = "0123456789";
  var SCRAMBLE_FRAME_MS = 35;
  var SCRAMBLE_TOTAL = 24;

  function scramble(el) {
    var text = el.getAttribute("data-scramble") || el.textContent;
    if (el._scrambleTimer) clearInterval(el._scrambleTimer);
    var frame = 0;
    el._scrambleTimer = setInterval(function () {
      frame++;
      var out = "";
      for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (c === " ") {
          out += " ";
          continue;
        }
        var progress = frame - i * 1.2;
        out += progress > SCRAMBLE_TOTAL * 0.6
          ? c
          : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      el.textContent = out;
      if (frame > SCRAMBLE_TOTAL + text.length) {
        clearInterval(el._scrambleTimer);
        el._scrambleTimer = null;
        el.textContent = text;
      }
    }, SCRAMBLE_FRAME_MS);
  }

  document.querySelectorAll(".mega-row").forEach(function (row) {
    row.addEventListener("mouseenter", function () { scramble(row); });
    row.addEventListener("focus", function () { scramble(row); });
  });
})();
