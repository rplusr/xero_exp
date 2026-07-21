(function () {
  var wrap = document.getElementById("values-stack-wrap");
  var stack = document.getElementById("values-stack");
  var zonesEl = document.getElementById("values-zones");
  if (!wrap || !stack || !zonesEl) return;

  var ICON_BASE = "assets/img/charms/";
  var ICON_NAMES = [
    "approval.png", "battery.png", "broken-link.png", "calendar-cross.png",
    "calendar-tick-1.png", "camera.png", "cash.png", "chart.png", "check.png",
    "click.png", "clipboard.png", "clock.png", "cocktail.png", "coconut.png",
    "coffee.png", "coin-xpression.png", "coin.png", "coins-expression-duo.png",
    "credit-card.png", "dali-clock.png", "deck-chair.png", "drum.png",
    "energy-meter.png", "fire.png", "folder.png", "globe-map.png", "globe.png",
    "graph.png", "heart.png", "hourglass.png", "house-keys.png", "idea.png",
    "inbox.png", "keys.png", "lanyard.png", "laptop.png", "link.png",
    "magnet.png", "notify-bell.png", "paper-plane-1.png", "paperwork.png",
    "parachute.png", "parcel.png", "percentage.png", "phone-notification.png",
    "phone.png", "postbox.png", "present-1.png", "search.png", "secure.png",
    "sold.png", "stamp.png", "sticky-note.png", "talk.png", "tap-to-pay.png",
    "tax-weight.png", "thumbs-ups.png", "tick.png", "timer.png", "trophy.png",
    "twinkle.png", "wallet.png", "zen.png"
  ];

  var CARD_COUNT = 8;
  var PILE_JITTER_X = 30;
  var PILE_JITTER_Y = 20;
  var PILE_ANGLE_MAX = 16;
  var TILT_MAX_DEG = 14;
  var PARALLAX_MAX_PX = 12;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  var icons = shuffle(ICON_NAMES).slice(0, CARD_COUNT);
  var cards = [];
  var zones = [];
  var pileState = [];
  var deltaState = [];

  function buildCards() {
    stack.innerHTML = "";
    zonesEl.innerHTML = "";
    cards = [];
    zones = [];

    for (var i = 0; i < CARD_COUNT; i++) {
      var card = document.createElement("div");
      card.className = "values-card";

      var tilt = document.createElement("div");
      tilt.className = "values-card-tilt";

      var flip = document.createElement("div");
      flip.className = "values-card-flip";

      var front = document.createElement("div");
      front.className = "values-card-face values-card-front";
      var frontInner = document.createElement("div");
      frontInner.className = "values-card-face-inner";
      var img = document.createElement("img");
      img.className = "values-card-image";
      img.src = ICON_BASE + icons[i];
      img.alt = "";
      frontInner.appendChild(img);
      front.appendChild(frontInner);

      var back = document.createElement("div");
      back.className = "values-card-face values-card-back";
      var backInner = document.createElement("div");
      backInner.className = "values-card-face-inner";
      var backLabel = document.createElement("span");
      backLabel.textContent = "Hello World";
      backInner.appendChild(backLabel);
      back.appendChild(backInner);

      flip.appendChild(front);
      flip.appendChild(back);
      tilt.appendChild(flip);
      card.appendChild(tilt);
      stack.appendChild(card);
      cards.push(card);

      var zone = document.createElement("div");
      zone.className = "values-zone";
      zonesEl.appendChild(zone);
      zones.push(zone);

      (function (cardEl, tiltEl, flipEl, imgEl) {
        cardEl.addEventListener("click", function () {
          flipEl.classList.toggle("is-flipped");
        });

        cardEl.addEventListener("mouseenter", function () {
          tiltEl.classList.add("is-tilting");
        });

        cardEl.addEventListener("mousemove", function (e) {
          var rect = cardEl.getBoundingClientRect();
          var relX = (e.clientX - rect.left) / rect.width - 0.5;
          var relY = (e.clientY - rect.top) / rect.height - 0.5;
          tiltEl.style.transform =
            "perspective(700px) rotateY(" + (relX * TILT_MAX_DEG).toFixed(2) + "deg) " +
            "rotateX(" + (-relY * TILT_MAX_DEG).toFixed(2) + "deg) scale(1.04)";
          imgEl.style.transform =
            "translate(" + (-relX * PARALLAX_MAX_PX).toFixed(1) + "px, " +
            (-relY * PARALLAX_MAX_PX).toFixed(1) + "px) scale(1.08)";
        });

        cardEl.addEventListener("mouseleave", function () {
          tiltEl.classList.remove("is-tilting");
          tiltEl.style.transform = "";
          imgEl.style.transform = "";
        });
      })(card, tilt, flip, img);
    }
  }

  function randomizePile() {
    pileState = cards.map(function () {
      return {
        x: (Math.random() - 0.5) * PILE_JITTER_X,
        y: (Math.random() - 0.5) * PILE_JITTER_Y,
        rot: (Math.random() - 0.5) * PILE_ANGLE_MAX * 2
      };
    });
  }

  function applyProgress(progress) {
    for (var i = 0; i < cards.length; i++) {
      var p = pileState[i];
      var d = deltaState[i] || { dx: 0, dy: 0 };
      var x = p.x + d.dx * progress;
      var y = p.y + d.dy * progress;
      var rot = p.rot * (1 - progress);
      cards[i].style.transform =
        "translate(calc(-50% + " + x.toFixed(1) + "px), calc(-50% + " + y.toFixed(1) + "px)) rotate(" + rot.toFixed(2) + "deg)";
      cards[i].style.zIndex = String(cards.length - i);
    }
  }

  function measure() {
    applyProgress(0);
    deltaState = cards.map(function (card, i) {
      var cardRect = card.getBoundingClientRect();
      var zoneRect = zones[i].getBoundingClientRect();
      var cardCx = cardRect.left + cardRect.width / 2;
      var cardCy = cardRect.top + cardRect.height / 2;
      var zoneCx = zoneRect.left + zoneRect.width / 2;
      var zoneCy = zoneRect.top + zoneRect.height / 2;
      return { dx: zoneCx - cardCx, dy: zoneCy - cardCy };
    });
  }

  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var rect = wrap.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = wrap.offsetHeight - vh;
      var progress = reduceMotion ? 1 : (total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0);
      applyProgress(progress);
      ticking = false;
    });
  }

  var resizeTimer;

  function init() {
    randomizePile();
    measure();
    onScroll();
  }

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 150);
  });
  window.addEventListener("scroll", onScroll, { passive: true });

  buildCards();
  init();
})();
