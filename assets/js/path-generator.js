/* ------------------------------------------------------------------ */
/* Monoweight path generator                                          */
/* Builds long, flowing, single-weight curves from a chain of joints   */
/* and exports them as clean SVG.                                     */
/* ------------------------------------------------------------------ */

(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Small maths helpers                                              */
  /* ---------------------------------------------------------------- */

  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  function fixed(n, precision) {
    var f = Math.pow(10, precision);
    var r = Math.round(n * f) / f;
    if (Object.is(r, -0)) r = 0;
    return String(r);
  }

  /* Deterministic PRNG so a seed always rebuilds the same line. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Smooth 1D value noise, layered into a few octaves. */
  function makeNoise(rand) {
    var table = new Float64Array(512);
    for (var i = 0; i < 512; i++) table[i] = rand() * 2 - 1;

    function noise(x) {
      var i0 = Math.floor(x);
      var f = x - i0;
      var a = table[((i0 % 512) + 512) % 512];
      var b = table[(((i0 + 1) % 512) + 512) % 512];
      var u = f * f * (3 - 2 * f);
      return a + (b - a) * u;
    }

    return function fbm(x, octaves) {
      var sum = 0, amp = 1, freq = 1, norm = 0;
      var n = octaves || 3;
      for (var o = 0; o < n; o++) {
        sum += noise(x * freq) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.07;
      }
      return sum / norm;
    };
  }

  /* Sum of harmonics — periodic, so closed shapes join seamlessly. */
  function makeHarmonics(rand, count) {
    var terms = [];
    for (var k = 0; k < count; k++) {
      terms.push({
        k: k + 1,
        amp: (rand() * 2 - 1) / (k + 1.4),
        phase: rand() * TAU
      });
    }
    return function (theta) {
      var sum = 0;
      for (var i = 0; i < terms.length; i++) {
        sum += terms[i].amp * Math.sin(terms[i].k * theta + terms[i].phase);
      }
      return sum;
    };
  }

  /* ---------------------------------------------------------------- */
  /* Curve construction                                               */
  /*                                                                  */
  /* Joints are interpolated with a non-uniform Catmull-Rom spline,    */
  /* converted to cubic Beziers. Centripetal knot spacing is the       */
  /* default because it never cusps or overshoots between joints,      */
  /* which is what keeps a dense chain of joints reading as one        */
  /* continuous, smooth line.                                          */
  /* ---------------------------------------------------------------- */

  function buildSegments(pts, closed, tension, alpha) {
    var n = pts.length;
    if (n < 2) return [];

    var segCount = closed ? n : n - 1;
    var i;

    /* Knot spacing for each segment: chord length raised to alpha. */
    var dt = [];
    for (i = 0; i < segCount; i++) {
      var d = Math.pow(Math.max(dist(pts[i], pts[(i + 1) % n]), 1e-6), alpha);
      dt.push(Math.max(d, 1e-6));
    }

    /* Velocity at each joint, kept per-side so corner joints can break. */
    var tanIn = [], tanOut = [];
    for (i = 0; i < n; i++) {
      var p = pts[i];
      var hasPrev = closed || i > 0;
      var hasNext = closed || i < n - 1;
      var vIn = null, vOut = null, dPrev = 0, dNext = 0;

      if (hasPrev) {
        var prevSeg = closed ? (i - 1 + segCount) % segCount : i - 1;
        var q = pts[(i - 1 + n) % n];
        dPrev = dt[prevSeg];
        vIn = { x: (p.x - q.x) / dPrev, y: (p.y - q.y) / dPrev };
      }
      if (hasNext) {
        var nextSeg = closed ? i % segCount : i;
        var r = pts[(i + 1) % n];
        dNext = dt[nextSeg];
        vOut = { x: (r.x - p.x) / dNext, y: (r.y - p.y) / dNext };
      }

      if (p.corner || !vIn || !vOut) {
        /* One-sided velocities: the line leaves along its own chord. */
        tanIn[i] = vIn || vOut;
        tanOut[i] = vOut || vIn;
      } else {
        var w = dPrev + dNext;
        var m = {
          x: (vIn.x * dNext + vOut.x * dPrev) / w,
          y: (vIn.y * dNext + vOut.y * dPrev) / w
        };
        tanIn[i] = m;
        tanOut[i] = m;
      }
    }

    /* Hermite -> Bezier: handles sit one third of the knot span out. */
    var segs = [];
    for (i = 0; i < segCount; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % n];
      var span = dt[i] * tension / 3;
      var ta = tanOut[i];
      var tb = tanIn[(i + 1) % n];
      segs.push({
        p0: { x: a.x, y: a.y },
        c1: { x: a.x + ta.x * span, y: a.y + ta.y * span },
        c2: { x: b.x - tb.x * span, y: b.y - tb.y * span },
        p1: { x: b.x, y: b.y }
      });
    }
    return segs;
  }

  function segmentsToPathData(segs, closed, precision) {
    if (!segs.length) return '';
    var p = typeof precision === 'number' ? precision : 2;
    var out = ['M', fixed(segs[0].p0.x, p), fixed(segs[0].p0.y, p)];

    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var straight =
        dist(s.c1, s.p0) < 1e-4 && dist(s.c2, s.p1) < 1e-4;
      if (straight) {
        out.push('L', fixed(s.p1.x, p), fixed(s.p1.y, p));
      } else {
        out.push(
          'C',
          fixed(s.c1.x, p), fixed(s.c1.y, p),
          fixed(s.c2.x, p), fixed(s.c2.y, p),
          fixed(s.p1.x, p), fixed(s.p1.y, p)
        );
      }
    }
    if (closed) out.push('Z');
    return out.join(' ');
  }

  function cubicAt(s, t) {
    var mt = 1 - t;
    var a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
      x: a * s.p0.x + b * s.c1.x + c * s.c2.x + d * s.p1.x,
      y: a * s.p0.y + b * s.c1.y + c * s.c2.y + d * s.p1.y
    };
  }

  /* Exact bounds of a cubic: endpoints plus any turning points. */
  function axisExtremes(p0, c1, c2, p1) {
    var vals = [p0, p1];
    var a = -p0 + 3 * c1 - 3 * c2 + p1;
    var b = 2 * (p0 - 2 * c1 + c2);
    var c = c1 - p0;
    var roots = [];

    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) > 1e-9) roots.push(-c / b);
    } else {
      var disc = b * b - 4 * a * c;
      if (disc >= 0) {
        var sq = Math.sqrt(disc);
        roots.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
      }
    }
    for (var i = 0; i < roots.length; i++) {
      var t = roots[i];
      if (t > 0 && t < 1) {
        var mt = 1 - t;
        vals.push(
          mt * mt * mt * p0 + 3 * mt * mt * t * c1 +
          3 * mt * t * t * c2 + t * t * t * p1
        );
      }
    }
    return vals;
  }

  function boundsOf(segs) {
    if (!segs.length) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var xs = axisExtremes(s.p0.x, s.c1.x, s.c2.x, s.p1.x);
      var ys = axisExtremes(s.p0.y, s.c1.y, s.c2.y, s.p1.y);
      for (var j = 0; j < xs.length; j++) {
        if (xs[j] < minX) minX = xs[j];
        if (xs[j] > maxX) maxX = xs[j];
      }
      for (var k = 0; k < ys.length; k++) {
        if (ys[k] < minY) minY = ys[k];
        if (ys[k] > maxY) maxY = ys[k];
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function curveLength(segs) {
    var total = 0;
    for (var i = 0; i < segs.length; i++) {
      var prev = segs[i].p0;
      for (var t = 1; t <= 16; t++) {
        var pt = cubicAt(segs[i], t / 16);
        total += dist(prev, pt);
        prev = pt;
      }
    }
    return total;
  }

  /* Nearest point on the rendered curve — used to insert joints. */
  function nearestOnCurve(segs, target) {
    var best = null;
    for (var i = 0; i < segs.length; i++) {
      for (var step = 0; step <= 24; step++) {
        var t = step / 24;
        var pt = cubicAt(segs[i], t);
        var d = dist(pt, target);
        if (!best || d < best.d) best = { d: d, seg: i, t: t, point: pt };
      }
    }
    return best;
  }

  /* Ramer-Douglas-Peucker, for turning freehand strokes into joints. */
  function simplify(points, tolerance) {
    if (points.length < 3) return points.slice();

    function segDist(p, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var len2 = dx * dx + dy * dy;
      var t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
      t = clamp(t, 0, 1);
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    var keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    var stack = [[0, points.length - 1]];

    while (stack.length) {
      var range = stack.pop();
      var first = range[0], last = range[1];
      var maxD = -1, index = -1;
      for (var i = first + 1; i < last; i++) {
        var d = segDist(points[i], points[first], points[last]);
        if (d > maxD) { maxD = d; index = i; }
      }
      if (maxD > tolerance && index > 0) {
        keep[index] = true;
        stack.push([first, index], [index, last]);
      }
    }

    return points.filter(function (_, i) { return keep[i]; });
  }

  /* ---------------------------------------------------------------- */
  /* Shape generators                                                 */
  /* ---------------------------------------------------------------- */

  /* Scale + centre a generated point cloud into the working box. */
  function fitToBox(pts, box) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    var w = Math.max(maxX - minX, 1e-6);
    var h = Math.max(maxY - minY, 1e-6);
    var scale = Math.min(box.w / w, box.h / h);
    var offX = box.x + (box.w - w * scale) / 2 - minX * scale;
    var offY = box.y + (box.h - h * scale) / 2 - minY * scale;
    return pts.map(function (p) {
      return { x: p.x * scale + offX, y: p.y * scale + offY, corner: !!p.corner };
    });
  }

  var GENERATORS = {
    meander: function (opts) {
      /* A walk whose heading is driven by noise. Everything is a
         function of t rather than of i, so changing the joint count
         resamples the same line instead of inventing a new one. */
      var rand = mulberry32(opts.seed);
      var fbm = makeNoise(rand);
      var offset = rand() * 40;
      var cycles = 2.5 + opts.wobble * 6;
      var swing = 0.5 + opts.wobble * 2.1;
      var drift = (rand() * 2 - 1) * 0.4;

      var pts = [];
      var x = 0, y = 0;
      var step = 1 / Math.max(opts.count - 1, 1);

      for (var i = 0; i < opts.count; i++) {
        pts.push({ x: x, y: y });
        var t = i * step;
        /* tanh keeps the heading bounded while letting the noise reach
           the full swing — raw fbm rarely gets near its own limits. */
        var wander = Math.tanh(fbm(t * cycles + offset, 3) * 2.2);
        var heading = wander * swing + drift * (t - 0.5);
        x += Math.cos(heading) * step;
        y += Math.sin(heading) * step;
      }
      return pts;
    },

    wave: function (opts) {
      var rand = mulberry32(opts.seed);
      var fbm = makeNoise(rand);
      var pts = [];
      var cycles = 1.2 + rand() * 2.6;
      var phase = rand() * TAU;
      var drift = (rand() * 2 - 1) * 0.35;

      for (var i = 0; i < opts.count; i++) {
        var t = opts.count === 1 ? 0 : i / (opts.count - 1);
        var envelope = 0.55 + 0.45 * fbm(t * 2.4 + opts.seed * 0.02, 2);
        var y =
          Math.sin(t * TAU * cycles + phase) * envelope * (0.4 + opts.wobble * 1.4) +
          drift * t;
        pts.push({ x: t * 3, y: y });
      }
      return pts;
    },

    loop: function (opts) {
      var rand = mulberry32(opts.seed);
      var harm = makeHarmonics(rand, 4);
      var pts = [];
      for (var i = 0; i < opts.count; i++) {
        var theta = (i / opts.count) * TAU;
        var r = 1 + harm(theta) * opts.wobble * 0.85;
        r = Math.max(r, 0.12);
        pts.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
      }
      return pts;
    },

    spiral: function (opts) {
      var rand = mulberry32(opts.seed);
      var fbm = makeNoise(rand);
      var turns = 2 + Math.floor(rand() * 3);
      var pts = [];
      for (var i = 0; i < opts.count; i++) {
        var t = opts.count === 1 ? 0 : i / (opts.count - 1);
        var theta = t * TAU * turns;
        var r = lerp(0.12, 1, t) * (1 + fbm(t * 5 + opts.seed * 0.01, 2) * opts.wobble * 0.5);
        pts.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r });
      }
      return pts;
    },

    ribbon: function (opts) {
      /* A long line that folds back on itself in stacked passes. */
      var rand = mulberry32(opts.seed);
      var fbm = makeNoise(rand);
      var rows = 2 + Math.floor(rand() * 3);
      var pts = [];
      for (var i = 0; i < opts.count; i++) {
        var t = opts.count === 1 ? 0 : i / (opts.count - 1);
        var u = t * rows;
        var row = Math.floor(u);
        var within = u - row;
        var dir = row % 2 === 0 ? within : 1 - within;
        var x = dir * 2.6 + fbm(t * 4 + 11, 2) * opts.wobble * 0.5;
        var y = u * 0.85 + fbm(t * 6 + opts.seed * 0.02, 2) * opts.wobble * 0.35;
        pts.push({ x: x, y: y });
      }
      return pts;
    }
  };

  function generatePoints(shape, opts, box) {
    var fn = GENERATORS[shape] || GENERATORS.meander;
    var raw = fn(opts);
    return fitToBox(raw, box);
  }

  /* ---------------------------------------------------------------- */
  /* Editor                                                           */
  /* ---------------------------------------------------------------- */

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var STORAGE_KEY = 'xero.path-generator.v1';

  var DOC = { w: 1200, h: 780 };
  var MARGIN = 90;

  var ALPHAS = { uniform: 0, centripetal: 0.5, chordal: 1 };

  var state = {
    shape: 'meander',
    count: 14,
    wobble: 0.55,
    seed: 1234,
    tension: 1,
    spacing: 'centripetal',
    closed: false,
    strokeWidth: 6,
    stroke: '#13B5EA',
    cap: 'round',
    background: 'navy',
    showGrid: false,
    snap: false,
    showJoints: true,
    jointDots: false,
    trim: true,
    precision: 2,
    points: []
  };

  var BACKGROUNDS = {
    navy: '#000856',
    paper: '#FFFFFF',
    deep: '#F4F6F8',
    ink: '#1A1A1A',
    none: null
  };

  var el = {};
  var segs = [];
  var mode = 'edit';
  var selected = -1;
  var drag = null;
  var lastClick = null;
  var freehand = null;
  var undoStack = [];
  var redoStack = [];

  function $(id) { return document.getElementById(id); }

  /* ------------------------------ history ------------------------- */

  function snapshot() {
    return JSON.stringify({
      points: state.points,
      closed: state.closed
    });
  }

  function pushHistory() {
    var snap = snapshot();
    if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }

  function applySnapshot(snap) {
    var data = JSON.parse(snap);
    state.points = data.points;
    state.closed = data.closed;
    if (el.closed) el.closed.checked = state.closed;
    selected = -1;
  }

  function undo() {
    if (undoStack.length < 2) return;
    redoStack.push(undoStack.pop());
    applySnapshot(undoStack[undoStack.length - 1]);
    render();
  }

  function redo() {
    if (!redoStack.length) return;
    var snap = redoStack.pop();
    undoStack.push(snap);
    applySnapshot(snap);
    render();
  }

  /* ------------------------------ geometry -> DOM ----------------- */

  function workingBox() {
    return { x: MARGIN, y: MARGIN, w: DOC.w - MARGIN * 2, h: DOC.h - MARGIN * 2 };
  }

  function regenerate(newSeed) {
    if (newSeed) state.seed = Math.floor(Math.random() * 99999);
    state.points = generatePoints(
      state.shape,
      { count: state.count, wobble: state.wobble, seed: state.seed },
      workingBox()
    );
    state.closed = state.shape === 'loop';
    if (el.closed) el.closed.checked = state.closed;
    selected = -1;
    pushHistory();
    render();
  }

  function currentSegments() {
    return buildSegments(
      state.points,
      state.closed,
      state.tension,
      ALPHAS[state.spacing]
    );
  }

  function pathData(precision) {
    return segmentsToPathData(segs, state.closed, precision);
  }

  function render() {
    segs = currentSegments();

    var bg = BACKGROUNDS[state.background];
    el.bgRect.setAttribute('fill', bg || 'transparent');
    el.stage.classList.toggle('is-checkered', !bg);
    el.grid.style.display = state.showGrid ? '' : 'none';

    var d = pathData(3);
    el.path.setAttribute('d', d);
    el.path.setAttribute('stroke', state.stroke);
    el.path.setAttribute('stroke-width', state.strokeWidth);
    el.path.setAttribute('stroke-linecap', state.cap);
    el.path.setAttribute('stroke-linejoin', state.cap === 'butt' ? 'miter' : 'round');
    el.hit.setAttribute('d', d);

    renderJoints();
    renderStatus();
    save();
  }

  function renderJoints() {
    while (el.joints.firstChild) el.joints.removeChild(el.joints.firstChild);
    el.joints.style.display = state.showJoints ? '' : 'none';
    if (!state.showJoints) return;

    state.points.forEach(function (p, i) {
      var node;
      if (p.corner) {
        node = document.createElementNS(SVG_NS, 'rect');
        node.setAttribute('x', p.x - 7);
        node.setAttribute('y', p.y - 7);
        node.setAttribute('width', 14);
        node.setAttribute('height', 14);
      } else {
        node = document.createElementNS(SVG_NS, 'circle');
        node.setAttribute('cx', p.x);
        node.setAttribute('cy', p.y);
        node.setAttribute('r', 8);
      }
      node.setAttribute('class', 'joint' + (i === selected ? ' is-selected' : ''));
      node.dataset.index = i;
      el.joints.appendChild(node);
    });
  }

  function renderStatus() {
    var len = curveLength(segs);
    el.statJoints.textContent = state.points.length;
    el.statLength.textContent = Math.round(len).toLocaleString();
    el.statSegments.textContent = segs.length;
  }

  /* ------------------------------ pointer -------------------------- */

  function toDoc(event) {
    var ctm = el.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var inv = ctm.inverse();
    var pt = el.svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    var p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  }

  function snapPoint(p) {
    if (!state.snap) return p;
    var g = 20;
    return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
  }

  function onPointerDown(event) {
    if (event.button === 2) return;
    var p = toDoc(event);

    if (mode === 'draw') {
      freehand = [p];
      el.svg.setPointerCapture(event.pointerId);
      el.draft.setAttribute('d', 'M ' + p.x + ' ' + p.y);
      el.draft.style.display = '';
      event.preventDefault();
      return;
    }

    var jointEl = event.target.closest ? event.target.closest('.joint') : null;
    if (jointEl) {
      var index = Number(jointEl.dataset.index);
      if (event.altKey) {
        removeJoint(index);
        return;
      }
      /* Cancelling pointerdown stops the browser's compatibility
         dblclick, so double-clicks are detected here instead. */
      var now = Date.now();
      if (lastClick && lastClick.index === index && now - lastClick.time < 400) {
        lastClick = null;
        toggleCorner(index);
        event.preventDefault();
        return;
      }
      lastClick = { index: index, time: now };

      selected = index;
      drag = { index: index, moved: false };
      el.svg.setPointerCapture(event.pointerId);
      renderJoints();
      event.preventDefault();
      return;
    }
    lastClick = null;

    if (event.target === el.hit) {
      insertJointAt(p);
      return;
    }

    appendJoint(p);
  }

  function onPointerMove(event) {
    if (freehand) {
      var fp = toDoc(event);
      var last = freehand[freehand.length - 1];
      if (dist(fp, last) > 3) {
        freehand.push(fp);
        el.draft.setAttribute('d', freehand.map(function (q, i) {
          return (i ? 'L ' : 'M ') + fixed(q.x, 1) + ' ' + fixed(q.y, 1);
        }).join(' '));
      }
      return;
    }

    if (!drag) return;
    var p = snapPoint(toDoc(event));
    var point = state.points[drag.index];
    if (!point) return;
    point.x = clamp(p.x, 0, DOC.w);
    point.y = clamp(p.y, 0, DOC.h);
    drag.moved = true;
    render();
  }

  function onPointerUp(event) {
    if (freehand) {
      finishFreehand();
      try { el.svg.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
      return;
    }
    if (drag) {
      if (drag.moved) pushHistory();
      drag = null;
      try { el.svg.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    }
  }

  function finishFreehand() {
    var stroke = freehand;
    freehand = null;
    el.draft.style.display = 'none';
    el.draft.setAttribute('d', '');
    if (!stroke || stroke.length < 3) return;

    var simplified = simplify(stroke, 9);
    /* Cap the joint count so the result stays editable. */
    if (simplified.length > 90) {
      var stepSize = simplified.length / 90;
      var thinned = [];
      for (var i = 0; i < 90; i++) thinned.push(simplified[Math.floor(i * stepSize)]);
      thinned.push(simplified[simplified.length - 1]);
      simplified = thinned;
    }

    state.points = simplified.map(function (p) {
      return { x: p.x, y: p.y, corner: false };
    });
    state.closed = false;
    if (el.closed) el.closed.checked = false;
    selected = -1;
    pushHistory();
    render();
  }

  /* ------------------------------ joint editing -------------------- */

  function appendJoint(p) {
    var snapped = snapPoint(p);
    state.points.push({ x: snapped.x, y: snapped.y, corner: false });
    selected = state.points.length - 1;
    pushHistory();
    render();
  }

  function insertJointAt(p) {
    if (!segs.length) return appendJoint(p);
    var hit = nearestOnCurve(segs, p);
    if (!hit) return;
    var index = hit.seg + 1;
    state.points.splice(index, 0, {
      x: hit.point.x,
      y: hit.point.y,
      corner: false
    });
    selected = index;
    pushHistory();
    render();
  }

  function removeJoint(index) {
    if (state.points.length <= 2) return;
    state.points.splice(index, 1);
    selected = -1;
    pushHistory();
    render();
  }

  function toggleCorner(index) {
    var p = state.points[index];
    if (!p) return;
    p.corner = !p.corner;
    pushHistory();
    render();
  }

  /* Insert a joint at the midpoint of every segment, on the curve, so
     the shape barely moves but gains twice the handles to shape it. */
  function subdivide() {
    if (segs.length < 1) return;
    var next = [];
    var n = state.points.length;
    for (var i = 0; i < segs.length; i++) {
      next.push(state.points[i]);
      var mid = cubicAt(segs[i], 0.5);
      next.push({ x: mid.x, y: mid.y, corner: false });
    }
    if (!state.closed) next.push(state.points[n - 1]);
    state.points = next;
    selected = -1;
    pushHistory();
    render();
    syncCountInput();
  }

  function thin() {
    if (state.points.length <= 3) return;
    var next = state.points.filter(function (p, i) {
      return i % 2 === 0 || p.corner;
    });
    if (!state.closed) {
      var last = state.points[state.points.length - 1];
      if (next[next.length - 1] !== last) next.push(last);
    }
    state.points = next;
    selected = -1;
    pushHistory();
    render();
    syncCountInput();
  }

  function syncCountInput() {
    state.count = clamp(state.points.length, 3, 200);
    if (el.count) {
      el.count.value = Math.min(state.count, Number(el.count.max));
      el.countOut.textContent = state.points.length;
    }
  }

  /* ------------------------------ export --------------------------- */

  function exportSvg() {
    var exportSegs = currentSegments();
    var d = segmentsToPathData(exportSegs, state.closed, state.precision);
    if (!d) return '';

    var view = { x: 0, y: 0, w: DOC.w, h: DOC.h };
    if (state.trim) {
      var b = boundsOf(exportSegs);
      if (b) {
        var pad = state.strokeWidth / 2 + (state.jointDots ? state.strokeWidth * 1.6 : 0) + 8;
        view = {
          x: b.x - pad,
          y: b.y - pad,
          w: b.w + pad * 2,
          h: b.h + pad * 2
        };
      }
    }

    var p = state.precision;
    var lines = [];
    lines.push('<svg xmlns="http://www.w3.org/2000/svg" ' +
      'width="' + fixed(view.w, p) + '" height="' + fixed(view.h, p) + '" ' +
      'viewBox="' + fixed(view.x, p) + ' ' + fixed(view.y, p) + ' ' +
      fixed(view.w, p) + ' ' + fixed(view.h, p) + '" fill="none">');

    var bg = BACKGROUNDS[state.background];
    if (bg) {
      lines.push('  <rect x="' + fixed(view.x, p) + '" y="' + fixed(view.y, p) +
        '" width="' + fixed(view.w, p) + '" height="' + fixed(view.h, p) +
        '" fill="' + bg + '"/>');
    }

    lines.push('  <g fill="none" stroke="' + state.stroke +
      '" stroke-width="' + state.strokeWidth +
      '" stroke-linecap="' + state.cap +
      '" stroke-linejoin="' + (state.cap === 'butt' ? 'miter' : 'round') + '">');
    lines.push('    <path d="' + d + '"/>');

    if (state.jointDots) {
      state.points.forEach(function (pt) {
        lines.push('    <circle cx="' + fixed(pt.x, p) + '" cy="' + fixed(pt.y, p) +
          '" r="' + fixed(state.strokeWidth * 1.15, p) + '"/>');
      });
    }

    lines.push('  </g>');
    lines.push('</svg>');
    return lines.join('\n');
  }

  function download() {
    var svg = exportSvg();
    if (!svg) return flash('Nothing to export yet');
    var blob = new Blob([svg], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'xero-path-' + state.shape + '-' + state.seed + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    flash('SVG downloaded');
  }

  function copyText(text, message) {
    if (!text) return flash('Nothing to copy yet');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flash(message); },
        function () { fallbackCopy(text, message); }
      );
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash(message); }
    catch (e) { flash('Copy failed — select the code manually'); }
    document.body.removeChild(ta);
  }

  var flashTimer = null;
  function flash(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, 1800);
  }

  /* ------------------------------ persistence ---------------------- */

  var saveTimer = null;

  function saveNow() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* storage unavailable — not fatal */ }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }

  function restore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.points) || saved.points.length < 2) return false;
      Object.keys(state).forEach(function (key) {
        if (key in saved) state[key] = saved[key];
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ------------------------------ controls ------------------------- */

  function bindRange(id, key, format) {
    var input = $(id);
    var out = $(id + '-out');
    el[key] = input;
    el[key + 'Out'] = out;
    if (!input) return;
    input.value = state[key];
    if (out) out.textContent = format ? format(state[key]) : state[key];

    input.addEventListener('input', function () {
      state[key] = Number(input.value);
      if (out) out.textContent = format ? format(state[key]) : state[key];
      if (key === 'count' || key === 'wobble') {
        regenerate(false);
      } else {
        render();
      }
    });
  }

  function bindToggle(id, key, after) {
    var input = $(id);
    el[key] = input;
    if (!input) return;
    input.checked = !!state[key];
    input.addEventListener('change', function () {
      state[key] = input.checked;
      if (after) after();
      render();
    });
  }

  function bindSegmented(name, key, after) {
    var group = document.querySelector('[data-segmented="' + name + '"]');
    if (!group) return;
    var buttons = Array.prototype.slice.call(group.querySelectorAll('button'));

    function sync() {
      buttons.forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.value === String(state[key]));
        b.setAttribute('aria-pressed', b.dataset.value === String(state[key]));
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        state[key] = b.dataset.value;
        sync();
        if (after) after();
        render();
      });
    });
    sync();
    el[key + 'Sync'] = sync;
  }

  function setMode(next) {
    mode = next;
    el.stage.classList.toggle('is-drawing', mode === 'draw');
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      var active = b.dataset.mode === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active);
    });
  }

  /* ------------------------------ init ----------------------------- */

  function init() {
    el.svg = $('canvas');
    if (!el.svg) return;

    el.stage = $('stage');
    el.bgRect = $('canvas-bg');
    el.grid = $('canvas-grid');
    el.path = $('curve');
    el.hit = $('curve-hit');
    el.draft = $('draft');
    el.joints = $('joints');
    el.toast = $('toast');
    el.statJoints = $('stat-joints');
    el.statLength = $('stat-length');
    el.statSegments = $('stat-segments');

    el.svg.setAttribute('viewBox', '0 0 ' + DOC.w + ' ' + DOC.h);
    el.bgRect.setAttribute('width', DOC.w);
    el.bgRect.setAttribute('height', DOC.h);

    var restored = restore();

    bindRange('count', 'count');
    bindRange('wobble', 'wobble', function (v) { return Math.round(v * 100) + '%'; });
    bindRange('tension', 'tension', function (v) { return v.toFixed(2); });
    bindRange('strokeWidth', 'strokeWidth', function (v) { return v + ' px'; });
    bindRange('precision', 'precision');

    bindToggle('closed', 'closed');
    bindToggle('showGrid', 'showGrid');
    bindToggle('snap', 'snap');
    bindToggle('showJoints', 'showJoints');
    bindToggle('jointDots', 'jointDots');
    bindToggle('trim', 'trim');

    bindSegmented('shape', 'shape', function () { regenerate(false); });
    bindSegmented('spacing', 'spacing');
    bindSegmented('cap', 'cap');
    bindSegmented('background', 'background');

    /* Stroke colour: swatches plus a free colour input. */
    var colourInput = $('stroke-colour');
    el.strokeColour = colourInput;
    if (colourInput) {
      colourInput.value = state.stroke;
      colourInput.addEventListener('input', function () {
        state.stroke = colourInput.value;
        syncSwatches();
        render();
      });
    }

    var swatches = Array.prototype.slice.call(
      document.querySelectorAll('.swatch[data-colour]')
    );
    function syncSwatches() {
      swatches.forEach(function (s) {
        s.classList.toggle(
          'is-active',
          s.dataset.colour.toLowerCase() === state.stroke.toLowerCase()
        );
      });
    }
    swatches.forEach(function (s) {
      s.style.setProperty('--swatch', s.dataset.colour);
      s.addEventListener('click', function () {
        state.stroke = s.dataset.colour;
        if (colourInput) colourInput.value = state.stroke;
        syncSwatches();
        render();
      });
    });
    syncSwatches();

    var seedInput = $('seed');
    el.seedInput = seedInput;
    if (seedInput) {
      seedInput.value = state.seed;
      seedInput.addEventListener('change', function () {
        state.seed = Number(seedInput.value) || 0;
        regenerate(false);
      });
    }

    $('shuffle').addEventListener('click', function () {
      regenerate(true);
      if (seedInput) seedInput.value = state.seed;
    });
    $('regenerate').addEventListener('click', function () { regenerate(false); });
    $('subdivide').addEventListener('click', subdivide);
    $('thin').addEventListener('click', thin);
    $('undo').addEventListener('click', undo);
    $('redo').addEventListener('click', redo);
    $('clear').addEventListener('click', function () {
      state.points = [];
      state.closed = false;
      if (el.closed) el.closed.checked = false;
      selected = -1;
      pushHistory();
      render();
      setMode('draw');
      flash('Cleared — draw or click to place joints');
    });

    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.mode); });
    });

    $('download').addEventListener('click', download);
    $('copy-svg').addEventListener('click', function () {
      copyText(exportSvg(), 'SVG markup copied');
    });
    $('copy-d').addEventListener('click', function () {
      copyText(
        segmentsToPathData(currentSegments(), state.closed, state.precision),
        'Path data copied'
      );
    });

    /* Canvas interaction */
    el.svg.addEventListener('pointerdown', onPointerDown);
    el.svg.addEventListener('pointermove', onPointerMove);
    el.svg.addEventListener('pointerup', onPointerUp);
    el.svg.addEventListener('pointercancel', onPointerUp);
    el.svg.addEventListener('contextmenu', function (event) {
      var jointEl = event.target.closest ? event.target.closest('.joint') : null;
      if (!jointEl) return;
      event.preventDefault();
      removeJoint(Number(jointEl.dataset.index));
    });
    window.addEventListener('pagehide', saveNow);

    document.addEventListener('keydown', function (event) {
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      var meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && selected >= 0) {
        event.preventDefault();
        removeJoint(selected);
        return;
      }
      switch (event.key.toLowerCase()) {
        case 'g': regenerate(true); if (seedInput) seedInput.value = state.seed; break;
        case 'j':
          state.showJoints = !state.showJoints;
          if (el.showJoints) el.showJoints.checked = state.showJoints;
          render();
          break;
        case 'c':
          state.closed = !state.closed;
          if (el.closed) el.closed.checked = state.closed;
          pushHistory();
          render();
          break;
        case 'd': setMode(mode === 'draw' ? 'edit' : 'draw'); break;
        case 'e': setMode('edit'); break;
      }
    });

    setMode('edit');

    if (restored) {
      pushHistory();
      render();
    } else {
      regenerate(false);
    }
    syncCountInput();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
