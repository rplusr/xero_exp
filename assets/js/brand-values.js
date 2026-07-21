(function () {
  var wrap = document.getElementById("values-stack-wrap");
  var stack = document.getElementById("values-stack");
  var zonesEl = document.getElementById("values-zones");
  var goxeroEl = document.getElementById("values-goxero");
  var canvas = document.getElementById("values-vortex-canvas");
  if (!wrap || !stack || !zonesEl || !goxeroEl || !canvas) return;
  var ctx = canvas.getContext("2d");

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
  var TILT_MAX_DEG = 14;
  var PARALLAX_MAX_PX = 12;
  var GRID_PHASE_END = 0.45;
  var PARTICLE_COUNT = 90;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function easeOutBack(x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

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

  var sinkPoint = { x: 0, y: 0 };
  var currentVortexProgress = 0;

  function applyProgress(progress) {
    var cardProgress = reduceMotion ? GRID_PHASE_END : progress;
    var t = Math.min(1, cardProgress / GRID_PHASE_END);

    for (var i = 0; i < cards.length; i++) {
      var p = pileState[i];
      var d = deltaState[i] || { dx: 0, dy: 0 };
      var gridX = p.x + d.dx * t;
      var gridY = p.y + d.dy * t;
      var x = gridX;
      var y = gridY;
      var rot = p.rot * (1 - t);
      var scale = 1;
      var opacity = 1;
      var blur = 0;

      if (cardProgress > GRID_PHASE_END) {
        var vp = clamp01((cardProgress - GRID_PHASE_END) / (1 - GRID_PHASE_END));
        var ve = vp * vp;
        var finalGridX = p.x + d.dx;
        var finalGridY = p.y + d.dy;
        var toSinkX = sinkPoint.x - finalGridX;
        var toSinkY = sinkPoint.y - finalGridY;
        var dist = Math.sqrt(toSinkX * toSinkX + toSinkY * toSinkY);
        var baseAngle = Math.atan2(toSinkY, toSinkX);
        var spins = 2.1 + (i % CARD_COUNT) * 0.4;
        var angle = baseAngle + ve * spins * Math.PI * 2;
        var radius = dist * (1 - ve);
        x = sinkPoint.x - Math.cos(angle) * radius;
        y = sinkPoint.y - Math.sin(angle) * radius;
        rot = ve * spins * 360;
        scale = 1 - ve * 0.94;
        opacity = 1 - Math.pow(ve, 2.4);
        blur = ve * 9;
      }

      cards[i].style.transform =
        "translate(calc(-50% + " + x.toFixed(1) + "px), calc(-50% + " + y.toFixed(1) + "px)) rotate(" + rot.toFixed(2) + "deg) scale(" + scale.toFixed(3) + ")";
      cards[i].style.zIndex = String(cards.length - i);
      cards[i].style.opacity = opacity.toFixed(3);
      cards[i].style.filter = blur > 0.4 ? "blur(" + blur.toFixed(1) + "px)" : "";
      cards[i].style.pointerEvents = opacity < 0.15 ? "none" : "";
    }

    var goxeroProgress = reduceMotion ? 1 : clamp01((progress - GRID_PHASE_END) / (1 - GRID_PHASE_END));
    var goxeroScale = 0.55 + 0.45 * easeOutBack(goxeroProgress);
    var goxeroOpacity = Math.min(1, goxeroProgress * 1.3);
    goxeroEl.style.transform = "translate(-50%, -50%) scale(" + goxeroScale.toFixed(3) + ")";
    goxeroEl.style.opacity = goxeroOpacity.toFixed(3);

    currentVortexProgress = goxeroProgress;
  }

  function measure() {
    applyProgress(0);
    var stackRect = stack.getBoundingClientRect();
    var containerCx = stackRect.left + stackRect.width / 2;
    var containerCy = stackRect.top + stackRect.height / 2;
    deltaState = cards.map(function (card, i) {
      var cardRect = card.getBoundingClientRect();
      var zoneRect = zones[i].getBoundingClientRect();
      var cardCx = cardRect.left + cardRect.width / 2;
      var cardCy = cardRect.top + cardRect.height / 2;
      var zoneCx = zoneRect.left + zoneRect.width / 2;
      var zoneCy = zoneRect.top + zoneRect.height / 2;
      return { dx: zoneCx - cardCx, dy: zoneCy - cardCy };
    });
    var goxeroRect = goxeroEl.getBoundingClientRect();
    sinkPoint = {
      x: (goxeroRect.left + goxeroRect.width / 2) - containerCx,
      y: (goxeroRect.top + goxeroRect.height / 2) - containerCy
    };
  }

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var canvasCssWidth = 0;
  var canvasCssHeight = 0;
  var particles = [];

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    canvasCssWidth = rect.width;
    canvasCssHeight = rect.height;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function initParticles() {
    var maxR = Math.min(canvasCssWidth, canvasCssHeight) * 0.46;
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var r = maxR * (0.3 + Math.random() * 0.7);
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: r,
        maxRadius: r,
        speed: 0.5 + Math.random() * 1.3,
        size: 1 + Math.random() * 2.4
      });
    }
  }

  var lastTime = null;

  function renderVortex(now) {
    requestAnimationFrame(renderVortex);
    if (lastTime === null) lastTime = now;
    var dt = Math.min(48, now - lastTime) / 1000;
    lastTime = now;

    var vp = currentVortexProgress;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (vp <= 0.001) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    var cx = canvasCssWidth / 2 + sinkPoint.x;
    var cy = canvasCssHeight / 2 + sinkPoint.y;

    var glowR = 70 + vp * 90;
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    grad.addColorStop(0, "rgba(19, 181, 234, " + (0.22 * vp).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(19, 181, 234, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < particles.length; i++) {
      var pt = particles[i];
      var spin = (0.4 + vp * 3.2) * pt.speed;
      var drain = (0.06 + vp * 0.9) * pt.speed;
      var prevAngle = pt.angle;
      var prevRadius = pt.radius;
      pt.angle += spin * dt;
      pt.radius -= drain * dt * pt.maxRadius * 0.35;
      if (pt.radius <= 4) {
        pt.radius = pt.maxRadius;
        pt.angle = Math.random() * Math.PI * 2;
        prevAngle = pt.angle;
        prevRadius = pt.radius;
      }
      var x1 = cx + Math.cos(prevAngle) * prevRadius;
      var y1 = cy + Math.sin(prevAngle) * prevRadius;
      var x2 = cx + Math.cos(pt.angle) * pt.radius;
      var y2 = cy + Math.sin(pt.angle) * pt.radius;
      var alpha = vp * (0.15 + 0.55 * (1 - pt.radius / pt.maxRadius));
      ctx.strokeStyle = "rgba(19, 181, 234, " + alpha.toFixed(3) + ")";
      ctx.lineWidth = pt.size;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
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
    resizeCanvas();
    randomizePile();
    measure();
    initParticles();
    onScroll();
  }

  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 150);
  });
  window.addEventListener("scroll", onScroll, { passive: true });

  buildCards();
  init();
  if (!reduceMotion) requestAnimationFrame(renderVortex);
})();
