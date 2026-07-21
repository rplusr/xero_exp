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

  function iconSrc(name) { return ICON_BASE + name; }

  var VALUES = [
    {
      name: "Go Bold",
      color: "#CF89FE",
      lead: "We go bold",
      reason: "because the future belongs to the ones building it, not debating it."
    },
    {
      name: "Go Fast",
      color: "#FF719B",
      lead: "We go fast",
      reason: "because the world doesn't slow down for anyone, and neither should we."
    },
    {
      name: "Go Further",
      color: "#FDCC08",
      lead: "We go further",
      reason: "because of the customers counting on us, and for the teammates building with us."
    },
    {
      name: "Go Together",
      color: "#6AEAAA",
      lead: "We go together",
      reason: "because no one wins alone, and the best of us makes the rest of us better."
    }
  ];

  var CARD_COUNT = VALUES.length;
  var PILE_JITTER_X = 30;
  var PILE_JITTER_Y = 20;
  var PILE_ANGLE_MAX = 16;
  var TILT_MAX_DEG = 16;
  var TILT_LIFT_PX = 26;
  var PARALLAX_MAX_PX = 14;
  var SPRING_FACTOR = 0.16;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function createTiltState(tiltEl, imgEl, glareEl) {
    return {
      tiltEl: tiltEl,
      imgEl: imgEl,
      glareEl: glareEl,
      targetRotX: 0, curRotX: 0,
      targetRotY: 0, curRotY: 0,
      targetScale: 1, curScale: 1,
      targetLift: 0, curLift: 0,
      targetImgX: 0, curImgX: 0,
      targetImgY: 0, curImgY: 0,
      targetImgScale: 1, curImgScale: 1,
      targetGlareX: 50, curGlareX: 50,
      targetGlareY: 50, curGlareY: 50,
      targetGlareOpacity: 0, curGlareOpacity: 0
    };
  }

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
  var tiltStates = [];

  function buildCards() {
    stack.innerHTML = "";
    zonesEl.innerHTML = "";
    cards = [];
    zones = [];
    tiltStates = [];

    for (var i = 0; i < CARD_COUNT; i++) {
      var value = VALUES[i];

      var card = document.createElement("div");
      card.className = "values-card";
      card.style.setProperty("--value-color", value.color);

      var tilt = document.createElement("div");
      tilt.className = "values-card-tilt";

      var flip = document.createElement("div");
      flip.className = "values-card-flip";

      var front = document.createElement("div");
      front.className = "values-card-face values-card-front";
      var frontInner = document.createElement("div");
      frontInner.className = "values-card-face-inner";
      var eyebrow = document.createElement("span");
      eyebrow.className = "values-card-eyebrow";
      eyebrow.textContent = ("0" + (i + 1)) + ".";
      var imageWrap = document.createElement("div");
      imageWrap.className = "values-card-image-wrap";
      var img = document.createElement("img");
      img.className = "values-card-image";
      img.src = iconSrc(icons[i]);
      img.alt = "";
      imageWrap.appendChild(img);
      var label = document.createElement("span");
      label.className = "values-card-label";
      label.textContent = value.name;
      frontInner.appendChild(eyebrow);
      frontInner.appendChild(imageWrap);
      frontInner.appendChild(label);
      front.appendChild(frontInner);

      var back = document.createElement("div");
      back.className = "values-card-face values-card-back";
      var backInner = document.createElement("div");
      backInner.className = "values-card-face-inner";
      var lead = document.createElement("span");
      lead.className = "values-card-lead";
      lead.textContent = value.lead;
      var reason = document.createElement("span");
      reason.className = "values-card-reason";
      reason.textContent = value.reason;
      backInner.appendChild(lead);
      backInner.appendChild(reason);
      back.appendChild(backInner);

      var glare = document.createElement("div");
      glare.className = "values-card-glare";

      flip.appendChild(front);
      flip.appendChild(back);
      tilt.appendChild(flip);
      tilt.appendChild(glare);
      card.appendChild(tilt);
      stack.appendChild(card);
      cards.push(card);

      var zone = document.createElement("div");
      zone.className = "values-zone";
      zonesEl.appendChild(zone);
      zones.push(zone);

      var state = createTiltState(tilt, img, glare);
      tiltStates.push(state);

      (function (cardEl, flipEl, tiltState) {
        cardEl.addEventListener("click", function () {
          flipEl.classList.toggle("is-flipped");
        });

        cardEl.addEventListener("mouseenter", function () {
          tiltState.targetScale = 1.05;
          tiltState.targetLift = TILT_LIFT_PX;
          tiltState.targetImgScale = 1.08;
          tiltState.targetGlareOpacity = 1;
        });

        cardEl.addEventListener("mousemove", function (e) {
          var rect = cardEl.getBoundingClientRect();
          var relX = (e.clientX - rect.left) / rect.width - 0.5;
          var relY = (e.clientY - rect.top) / rect.height - 0.5;
          tiltState.targetRotY = relX * TILT_MAX_DEG;
          tiltState.targetRotX = -relY * TILT_MAX_DEG;
          tiltState.targetImgX = -relX * PARALLAX_MAX_PX;
          tiltState.targetImgY = -relY * PARALLAX_MAX_PX;
          tiltState.targetGlareX = (relX + 0.5) * 100;
          tiltState.targetGlareY = (relY + 0.5) * 100;
        });

        cardEl.addEventListener("mouseleave", function () {
          tiltState.targetRotX = 0;
          tiltState.targetRotY = 0;
          tiltState.targetScale = 1;
          tiltState.targetLift = 0;
          tiltState.targetImgX = 0;
          tiltState.targetImgY = 0;
          tiltState.targetImgScale = 1;
          tiltState.targetGlareOpacity = 0;
        });
      })(card, flip, state);
    }
  }

  function stepTiltSpring() {
    for (var i = 0; i < tiltStates.length; i++) {
      var s = tiltStates[i];
      s.curRotX += (s.targetRotX - s.curRotX) * SPRING_FACTOR;
      s.curRotY += (s.targetRotY - s.curRotY) * SPRING_FACTOR;
      s.curScale += (s.targetScale - s.curScale) * SPRING_FACTOR;
      s.curLift += (s.targetLift - s.curLift) * SPRING_FACTOR;
      s.curImgX += (s.targetImgX - s.curImgX) * SPRING_FACTOR;
      s.curImgY += (s.targetImgY - s.curImgY) * SPRING_FACTOR;
      s.curImgScale += (s.targetImgScale - s.curImgScale) * SPRING_FACTOR;
      s.curGlareX += (s.targetGlareX - s.curGlareX) * SPRING_FACTOR;
      s.curGlareY += (s.targetGlareY - s.curGlareY) * SPRING_FACTOR;
      s.curGlareOpacity += (s.targetGlareOpacity - s.curGlareOpacity) * SPRING_FACTOR;

      s.tiltEl.style.transform =
        "perspective(700px) translateZ(" + s.curLift.toFixed(2) + "px) " +
        "rotateY(" + s.curRotY.toFixed(2) + "deg) rotateX(" + s.curRotX.toFixed(2) + "deg) " +
        "scale(" + s.curScale.toFixed(3) + ")";
      s.imgEl.style.transform =
        "translate(" + s.curImgX.toFixed(1) + "px, " + s.curImgY.toFixed(1) + "px) scale(" + s.curImgScale.toFixed(3) + ")";
      s.glareEl.style.setProperty("--glare-x", s.curGlareX.toFixed(1) + "%");
      s.glareEl.style.setProperty("--glare-y", s.curGlareY.toFixed(1) + "%");
      s.glareEl.style.opacity = s.curGlareOpacity.toFixed(3);
    }
    requestAnimationFrame(stepTiltSpring);
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
  if (!reduceMotion) requestAnimationFrame(stepTiltSpring);
})();
