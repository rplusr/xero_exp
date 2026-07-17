(function () {
  var host = document.getElementById("grid-host");
  if (!host) return;

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

  // ball-pit physics, ported from the react-bits Ballpit config the brief
  // referenced (count/gravity/friction/wallBounce/followCursor), swapping
  // the rendered spheres for the brand's charm icons
  var COUNT = 50;
  var GRAVITY = 0.6;
  var FRICTION = 0.919;
  var WALL_BOUNCE = 0.75;
  var FOLLOW_CURSOR = false;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.createElement("canvas");
  canvas.className = "ballpit-canvas";
  host.insertBefore(canvas, host.firstChild);
  var ctx = canvas.getContext("2d");

  var W = 0, H = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var balls = [];
  var images = [];
  var pointer = { x: -9999, y: -9999, active: false };
  var resizeTimer = null;

  function loadImages(cb) {
    var remaining = ICON_NAMES.length;
    ICON_NAMES.forEach(function (name, i) {
      var img = new Image();
      img.onload = img.onerror = function () {
        remaining--;
        if (remaining === 0) cb();
      };
      img.src = iconSrc(name);
      images[i] = img;
    });
  }

  function resize() {
    W = host.clientWidth;
    H = host.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function makeBalls() {
    balls = [];
    for (var i = 0; i < COUNT; i++) {
      var r = 16 + Math.random() * 16;
      balls.push({
        x: Math.random() * Math.max(W, 1),
        y: Math.random() * Math.max(H, 1) * 0.5,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 2,
        r: r,
        img: images[i % images.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.04
      });
    }
  }

  function resolveCollision(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var minDist = a.r + b.r;
    if (dist === 0 || dist >= minDist) return;

    var nx = dx / dist, ny = dy / dist;
    var overlap = minDist - dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    var velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) return;

    var impulse = -(1 + WALL_BOUNCE) * velAlongNormal / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }

  function step() {
    var i, b;
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (!reduceMotion) b.vy += GRAVITY;
      b.vx *= FRICTION;
      b.vy *= FRICTION;

      if (FOLLOW_CURSOR && pointer.active) {
        var dx = b.x - pointer.x, dy = b.y - pointer.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var radius = 90;
        if (dist < radius) {
          var force = ((radius - dist) / radius) * 3;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }
      }

      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vrot;

      if (b.x - b.r < 0) { b.x = b.r; b.vx = -b.vx * WALL_BOUNCE; }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -b.vx * WALL_BOUNCE; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = -b.vy * WALL_BOUNCE; }
      if (b.y + b.r > H) { b.y = H - b.r; b.vy = -b.vy * WALL_BOUNCE; }
    }

    for (var pass = 0; pass < 2; pass++) {
      for (var m = 0; m < balls.length; m++) {
        for (var n = m + 1; n < balls.length; n++) {
          resolveCollision(balls[m], balls[n]);
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.img || !b.img.complete || !b.img.naturalWidth) continue;
      var size = b.r * 2;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.drawImage(b.img, -b.r, -b.r, size, size);
      ctx.restore();
    }
  }

  function tick() {
    step();
    draw();
    requestAnimationFrame(tick);
  }

  function onPointerMove(e) {
    var rect = host.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }

  if (FOLLOW_CURSOR) {
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerleave", onPointerLeave);
  }
  window.addEventListener("resize", onResize);

  loadImages(function () {
    resize();
    makeBalls();
    requestAnimationFrame(tick);
  });
})();
