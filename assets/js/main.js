(function () {
  var header = document.getElementById("site-header");
  var toggle = document.getElementById("menu-toggle");
  var overlay = document.getElementById("mobile-overlay");
  var navItems = document.querySelectorAll(".nav-item");
  var megaPanel = document.getElementById("mega-panel");
  var megaContents = document.querySelectorAll(".mega-content");
  var closeTimer = null;

  function showPanelContent(key) {
    megaContents.forEach(function (content) {
      content.classList.toggle("is-active", content.getAttribute("data-panel") === key);
    });
  }

  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var mobileItems = document.querySelectorAll(".mobile-item");

  function closeMobileAccordion() {
    mobileItems.forEach(function (item) {
      item.classList.remove("is-open");
      item.querySelector(".mobile-link").setAttribute("aria-expanded", "false");
    });
  }

  function closeOverlay() {
    overlay.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    closeMobileAccordion();
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    overlay.classList.toggle("is-open", !open);
    if (open) closeMobileAccordion();
  });

  overlay.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeOverlay);
  });

  mobileItems.forEach(function (item) {
    var itemToggle = item.querySelector(".mobile-link");
    itemToggle.addEventListener("click", function () {
      var isOpen = itemToggle.getAttribute("aria-expanded") === "true";
      mobileItems.forEach(function (other) {
        if (other !== item) {
          other.classList.remove("is-open");
          other.querySelector(".mobile-link").setAttribute("aria-expanded", "false");
        }
      });
      item.classList.toggle("is-open", !isOpen);
      itemToggle.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  function openMega(item) {
    clearTimeout(closeTimer);
    navItems.forEach(function (i) {
      i.classList.remove("is-open");
      i.querySelector(".nav-link").setAttribute("aria-expanded", "false");
    });
    item.classList.add("is-open");
    item.querySelector(".nav-link").setAttribute("aria-expanded", "true");
    showPanelContent(item.getAttribute("data-panel"));
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
  // restricted to digits per the brand's tabular-numeral convention;
  // slow enough per-digit to actually read, short enough not to labour
  var SCRAMBLE_CHARS = "0123456789";
  var SCRAMBLE_FRAME_MS = 40;
  var SCRAMBLE_TOTAL = 8;
  var SCRAMBLE_STAGGER = 0.5;

  function scramble(el) {
    // .mobile-link buttons carry a leading <span> for the label plus a
    // chevron sibling; scramble that span's text only so the chevron
    // markup isn't clobbered. Plain <a> targets (mega-row/mobile-sublink)
    // have no such child, so they scramble their own textContent as before.
    var target = el.querySelector(":scope > span:first-child") || el;
    var text = el.getAttribute("data-scramble") || target.textContent;
    if (el._scrambleTimer) clearInterval(el._scrambleTimer);
    var frame = 0;
    var stopFrame = SCRAMBLE_TOTAL + (text.length - 1) * SCRAMBLE_STAGGER + 3;
    el._scrambleTimer = setInterval(function () {
      frame++;
      var out = "";
      for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (c === " ") {
          out += " ";
          continue;
        }
        var progress = frame - i * SCRAMBLE_STAGGER;
        out += progress > SCRAMBLE_TOTAL * 0.6
          ? c
          : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      target.textContent = out;
      if (frame > stopFrame) {
        clearInterval(el._scrambleTimer);
        el._scrambleTimer = null;
        target.textContent = text;
      }
    }, SCRAMBLE_FRAME_MS);
  }

  document.querySelectorAll(".mega-row, .mobile-link, .mobile-sublink").forEach(function (row) {
    row.addEventListener("mouseenter", function () { scramble(row); });
    row.addEventListener("focus", function () { scramble(row); });
  });
})();
