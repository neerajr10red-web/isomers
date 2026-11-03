/* Isomers by Neeraj the Beloved — 3D molecule viewer.
   A small ball-and-stick renderer written for this site (canvas 2D, no libraries).
   Drag to rotate · pinch or Ctrl+scroll to zoom · double-click to reset · arrow keys when focused. */
(function () {
  'use strict';
  const ISO = window.ISO = window.ISO || {};
  const V = ISO.vec;
  const G = ISO.geom;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const TAU = Math.PI * 2;

  /* ---------- Quaternions [w, x, y, z] ---------- */
  const Q = ISO.quat = {
    identity: function () { return [1, 0, 0, 0]; },
    mul: function (a, b) {
      return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
      ];
    },
    normalize: function (q) {
      const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
      return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    },
    fromAxisAngle: function (ax, ay, az, angle) {
      const l = Math.hypot(ax, ay, az) || 1, s = Math.sin(angle / 2) / l;
      return [Math.cos(angle / 2), ax * s, ay * s, az * s];
    },
    toMat: function (q) {
      const w = q[0], x = q[1], y = q[2], z = q[3];
      return [
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)
      ];
    },
    rotate: function (q, v) {
      const m = Q.toMat(q);
      return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
    },
    fromMat: function (m) {
      const tr = m[0] + m[4] + m[8];
      let w, x, y, z, s;
      if (tr > 0) { s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s; }
      else if (m[0] > m[4] && m[0] > m[8]) { s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s; }
      else if (m[4] > m[8]) { s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s; }
      else { s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4; }
      return Q.normalize([w, x, y, z]);
    },
    slerp: function (a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      let c = b;
      if (d < 0) { d = -d; c = [-b[0], -b[1], -b[2], -b[3]]; }
      if (d > 0.9995) return Q.normalize([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t, a[3] + (c[3] - a[3]) * t]);
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return [a[0] * wa + c[0] * wb, a[1] * wa + c[1] * wb, a[2] * wa + c[2] * wb, a[3] * wa + c[3] * wb];
    },
    /** Rotation that makes a molecule spin like the mirror image of one using q (mirror plane x = 0). */
    mirror: function (q) { return [q[0], q[1], -q[2], -q[3]]; },
    random: function () {
      const u1 = Math.random(), u2 = Math.random() * TAU, u3 = Math.random() * TAU;
      const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
      return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
    },
    /** Rotation taking direction s1 to t1 exactly, and s2 as close to t2 as possible. */
    alignTwo: function (s1, s2, t1, t2) {
      const frame = function (a, b) {
        const u = V.norm(a), n = V.norm(V.cross(a, b));
        return [u, n, V.cross(u, n)];
      };
      const S = frame(s1, s2), T = frame(t1, t2);
      const m = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m.push(T[0][r] * S[0][c] + T[1][r] * S[1][c] + T[2][r] * S[2][c]);
      return Q.fromMat(m);
    }
  };
  const DEFAULT_Q = Q.mul(Q.fromAxisAngle(1, 0, 0, 0.3), Q.fromAxisAngle(0, 1, 0, -0.32));
  ISO.DEFAULT_VIEW = DEFAULT_Q;

  /* ---------- Atom styles (CPK colours) ---------- */
  const ELEMENTS = ISO.ELEMENTS = {
    H: { color: '#eceef2', ball: 0.25, vdw: 1.20, name: 'Hydrogen', ink: '#2b2f38' },
    C: { color: '#646b76', ball: 0.40, vdw: 1.70, name: 'Carbon', ink: '#ffffff' },
    O: { color: '#e3342b', ball: 0.38, vdw: 1.52, name: 'Oxygen', ink: '#ffffff' },
    N: { color: '#3456e6', ball: 0.38, vdw: 1.55, name: 'Nitrogen', ink: '#ffffff' },
    F: { color: '#93d84a', ball: 0.36, vdw: 1.47, name: 'Fluorine', ink: '#1d2a10' },
    Cl: { color: '#1ea84c', ball: 0.47, vdw: 1.75, name: 'Chlorine', ink: '#ffffff' },
    Br: { color: '#9b2d26', ball: 0.52, vdw: 1.85, name: 'Bromine', ink: '#ffffff' }
  };
  const FALLBACK = { color: '#d36ad6', ball: 0.4, vdw: 1.7, name: 'Atom', ink: '#ffffff' };
  const elStyle = function (el) { return ELEMENTS[el] || FALLBACK; };

  /* ---------- Colour helpers ---------- */
  function hexToRgb(h) {
    h = String(h).trim();
    if (h[0] === '#') {
      if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
      return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }
    const m = h.match(/(\d+(\.\d+)?)/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  const mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  const rgb = function (c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; };
  const WHITE = [255, 255, 255], BLACK = [0, 0, 0];

  let themeCache = null;
  function theme() {
    if (!themeCache) {
      const cs = getComputedStyle(document.documentElement);
      const get = function (n, fb) { return (cs.getPropertyValue(n) || '').trim() || fb; };
      const bad = hexToRgb(get('--bad', '#c0362e'));
      themeCache = {
        bg: hexToRgb(get('--viewer-bg', '#f8f9fd')),
        accent: get('--accent', '#c62828'),
        ink: get('--text', '#1b1e23'),
        bad: rgb(bad), good: get('--good', '#0f7f59'), warn: get('--warn', '#a35f00'),
        strain: { base: rgb(bad), light: rgb(mix(bad, WHITE, 0.45)), dark: rgb(mix(bad, BLACK, 0.35)) }
      };
    }
    return themeCache;
  }
  const shadeCache = new Map();
  function shade(el, fog, bg) {
    const key = el + '|' + fog + '|' + bg[0] + ',' + bg[1] + ',' + bg[2];
    let s = shadeCache.get(key);
    if (!s) {
      const base = hexToRgb(elStyle(el).color);
      const f = fog / 7 * 0.22; // gentle fade for atoms at the back (stronger fades lose them on dark backgrounds)
      s = {
        light: rgb(mix(mix(base, WHITE, 0.62), bg, f)),
        base: rgb(mix(base, bg, f)),
        dark: rgb(mix(mix(base, BLACK, 0.5), bg, f)),
        rim: rgb(mix(mix(base, BLACK, 0.62), bg, f))
      };
      if (shadeCache.size > 800) shadeCache.clear();
      shadeCache.set(key, s);
    }
    return s;
  }
  const fogLevel = function (z, R) {
    const f = Math.max(0, Math.min(1, (R * 0.9 - z) / (1.8 * R)));
    return Math.round(f * 7);
  };

  /* ---------- One animation loop for every viewer on the page ---------- */
  const registry = new Set();
  let rafId = 0, lastT = 0;
  function schedule() { if (!rafId) rafId = requestAnimationFrame(tick); }
  function tick(t) {
    rafId = 0;
    const dt = lastT ? Math.min(50, t - lastT) : 16.7;
    lastT = t;
    let more = false;
    registry.forEach(function (v) {
      if (v._step(dt, t)) more = true;
      if (v.dirty && v.visible) v.draw(t);
    });
    if (more) schedule(); else lastT = 0;
  }
  document.addEventListener('iso:theme', function () {
    themeCache = null;
    registry.forEach(function (v) { v.requestDraw(); });
  });
  /** Draw every viewer right now (handy for debugging from the browser console). */
  ISO.drawAll = function () {
    const t = performance.now();
    registry.forEach(function (v) { v.resize(); v.draw(t); });
    return registry.size;
  };

  /* ---------- Viewer ---------- */
  function Viewer(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({
      style: 'ball', showH: true, labels: false, autoSpin: false, spinSpeed: 0.5,
      fit: 0.95, interactive: true, initialQ: null, minZoom: 0.4, maxZoom: 4
    }, opts || {});
    if (ISO.reducedMotion) this.opts.autoSpin = false;
    this.initialQ = (this.opts.initialQ || DEFAULT_Q).slice();
    this.q = this.initialQ.slice();
    this.zoom = 1;
    this.mol = null;
    this.ghost = null;
    this.frameMols = null;
    this.frameR = 3;
    this.highlights = null;
    this.pulse = false;
    this.axis = null;
    this.dpr = 1;
    this.visible = true;
    this.dirty = true;
    this.dragging = false;
    this.inertia = null;
    this.tween = null;
    this.fade = null;
    this.spinSuppressed = false;
    this.touchedAt = -Infinity; // last time someone dragged, zoomed or used the keys
    this.handlers = {};
    this._bind();
    this._observe();
    registry.add(this);
  }
  ISO.Viewer = Viewer;

  Viewer.prototype.on = function (evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; };
  Viewer.prototype.emit = function (evt, data) {
    const hs = this.handlers[evt];
    if (hs) hs.slice().forEach(function (h) { h(data || {}); });
  };
  Viewer.prototype.requestDraw = function () { this.dirty = true; schedule(); };

  /** Show a molecule. opts: frame (molecules to size the view by), keepView, transition. */
  Viewer.prototype.setMolecule = function (mol, opts) {
    opts = opts || {};
    this.mol = mol;
    if ('frame' in opts) this.frameMols = opts.frame;
    this._updateFrame();
    if (!opts.keepView) { this.q = this.initialQ.slice(); this.zoom = 1; this.inertia = null; this.tween = null; }
    if (opts.transition && !ISO.reducedMotion) this.fade = { start: 0, ms: 380 };
    this.highlights = null;
    this.pulse = false;
    this._label();
    this.requestDraw();
  };
  Viewer.prototype._label = function () {
    if (!this.mol) return;
    const name = String(this.mol.name || 'Molecule').replace(/<[^>]+>/g, '');
    this.canvas.setAttribute('aria-label', name + (this.mol.formula ? ' (' + this.mol.formula + ')' : '') +
      '. Interactive 3D model: drag, or focus it and use the arrow keys, to rotate.');
  };
  Viewer.prototype.setFrame = function (mols) { this.frameMols = mols; this._updateFrame(); this.requestDraw(); };
  Viewer.prototype._updateFrame = function () {
    let mols = (this.frameMols && this.frameMols.length) ? this.frameMols.slice() : [this.mol];
    if (this.ghost) mols.push(this.ghost.mol);
    let r = 0;
    mols.forEach(function (m) { if (m) r = Math.max(r, G.radius(m)); });
    this.frameR = Math.max(1.6, r + (this.opts.style === 'space' ? 1.5 : 0.42));
  };
  /** Overlay a faded "ghost" molecule. opts.q fixes its rotation; opts.follow makes it turn with the view. */
  Viewer.prototype.setGhost = function (mol, opts) {
    opts = opts || {};
    this.ghost = mol ? { mol: mol, q: (opts.q || this.q).slice(), follow: !!opts.follow } : null;
    this._updateFrame();
    this.requestDraw();
  };
  Viewer.prototype.setStyle = function (style) { this.opts.style = style; this._updateFrame(); this.requestDraw(); };
  Viewer.prototype.setShowH = function (on) { this.opts.showH = !!on; this.requestDraw(); };
  Viewer.prototype.setLabels = function (on) { this.opts.labels = !!on; this.requestDraw(); };
  Viewer.prototype.setAutoSpin = function (on) { this.opts.autoSpin = !!on; this.requestDraw(); };
  Viewer.prototype.setZoom = function (z) {
    const nz = Math.max(this.opts.minZoom, Math.min(this.opts.maxZoom, z));
    if (nz !== this.zoom) { this.zoom = nz; this.requestDraw(); this.emit('zoom'); }
  };
  Viewer.prototype.setRotation = function (q, silent) {
    this.q = Q.normalize(q);
    this.requestDraw();
    if (!silent) this.emit('rotate');
  };
  Viewer.prototype.rotateBy = function (ax, ay, az, angle, user) {
    this.q = Q.normalize(Q.mul(Q.fromAxisAngle(ax, ay, az, angle), this.q));
    this.requestDraw();
    this.emit('rotate', { user: !!user });
  };
  Viewer.prototype.resetView = function () {
    this.inertia = null;
    this.zoom = 1;
    this.emit('zoom');
    this.animateTo(this.initialQ, 450);
  };
  /** Turn smoothly to q. always: still call done if someone grabs the model part-way. */
  Viewer.prototype.animateTo = function (q, ms, done, always) {
    this.inertia = null;
    this.tween = { from: this.q.slice(), to: q.slice(), start: 0, ms: ISO.reducedMotion ? 1 : (ms || 600), done: done, always: !!always };
    schedule();
  };
  /** map: {atomIndex: 'accent' | 'bad' | 'good' | cssColour}. */
  Viewer.prototype.setHighlights = function (map, pulse) {
    this.highlights = map || null;
    this.pulse = !!pulse && !!map;
    this.requestDraw();
  };
  Viewer.prototype.setAxis = function (pair) { this.axis = pair || null; this.requestDraw(); };
  Viewer.prototype.isExpanded = function () {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    return !!(fs && fs.contains(this.canvas)) || !!this.canvas.closest('.is-expanded');
  };
  Viewer.prototype.destroy = function () {
    registry.delete(this);
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    if (this._unbind) this._unbind();
    this.handlers = {};
  };

  /* ---------- Per-frame motion ---------- */
  const FRICTION = 0.92;    // how fast a flick slows down (share of speed kept each 60 fps frame)
  const MAX_FLING = 0.006;  // fastest a flick can spin: radians per ms (about one turn a second)
  const SPIN_PAUSE = 2500;  // auto-spin waits this long (ms) after someone lets go…
  const SPIN_RAMP = 1200;   // …then speeds back up over this long
  Viewer.prototype._step = function (dt, t) {
    let more = false;
    if (this.fade) {
      if (!this.fade.start) this.fade.start = t;
      if (t - this.fade.start >= this.fade.ms) this.fade = null; else more = true;
      this.dirty = true;
    }
    if (this.tween) {
      const tw = this.tween;
      if (!tw.start) tw.start = t;
      const p = Math.min(1, (t - tw.start) / tw.ms);
      this.q = Q.slerp(tw.from, tw.to, ISO.ease ? ISO.ease.inOut(p) : p);
      this.dirty = true;
      if (p >= 1) { this.q = Q.normalize(tw.to); this.tween = null; }
      else more = true;
      this.emit('rotate', { tween: true });
      if (p >= 1 && tw.done) tw.done();
    } else if (this.inertia) {
      const it = this.inertia;
      this.q = Q.normalize(Q.mul(Q.fromAxisAngle(it.ax, it.ay, 0, it.w * dt), this.q));
      it.w *= Math.pow(FRICTION, dt / 16.7);
      if (it.w < 0.0001) this.inertia = null; else more = true;
      this.dirty = true;
      this.emit('rotate', { user: true });
      if (!this.inertia) this.emit('settle');
    } else if (this.opts.autoSpin && !this.dragging && !this.spinSuppressed && this.visible && this.mol) {
      // After someone plays with the model, wait a moment, then ease back into spinning.
      more = true;
      const since = t - this.touchedAt;
      if (since > SPIN_PAUSE) {
        const k = Math.min(1, (since - SPIN_PAUSE) / SPIN_RAMP);
        const speed = this.opts.spinSpeed * k * k * (3 - 2 * k);
        this.q = Q.normalize(Q.mul(Q.fromAxisAngle(0, 1, 0, speed * dt / 1000), this.q));
        this.dirty = true;
        this.emit('rotate', { auto: true });
      }
    }
    if (this.pulse && this.visible) { this.dirty = true; more = true; }
    // Keep the loop awake for a model that should go back to spinning (after a flick or animation ends).
    if (this.opts.autoSpin && !this.dragging && !this.spinSuppressed && this.visible && this.mol) more = true;
    return more;
  };

  /* ---------- Input ---------- */
  Viewer.prototype._bind = function () {
    const self = this, c = this.canvas;
    c.tabIndex = 0;
    const pts = new Map();   // fingers (or the mouse) pressed on this model right now
    const samples = [];      // the last few moves, to work out how fast a flick was
    let pinch = 0, pinched = false, moved = 0, lastDragEnd = -Infinity;
    const dist2 = function () {
      const a = Array.from(pts.values());
      return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    };
    // How far (radians) one pixel of dragging turns the model, so small and big models feel the same.
    const perPx = function () {
      const side = Math.min(c.clientWidth, c.clientHeight) || 300;
      return Math.max(0.005, Math.min(0.0105, 3 / side));
    };
    const setDragging = function (on) { self.dragging = on; c.classList.toggle('dragging', on); };
    const touch = function () { self.touchedAt = performance.now(); };
    // Grabbing the model stops any animation. Some animations still finish their job (like showing an explanation).
    const stopMotion = function () {
      const tw = self.tween;
      self.inertia = null;
      self.tween = null;
      if (tw && tw.always && tw.done) tw.done();
    };

    const finish = function (id, fling) {
      if (!pts.has(id)) return;
      pts.delete(id);
      if (pts.size < 2) pinch = 0;
      if (pts.size) return;
      setDragging(false);
      touch();
      const now = performance.now();
      if (moved > 6) lastDragEnd = now;
      // A flick keeps it turning for a moment, at the average speed of the last tenth of a second.
      const last = samples[samples.length - 1];
      if (fling && !pinched && !ISO.reducedMotion && last && now - last.t < 70) {
        let sx = 0, sy = 0;
        samples.forEach(function (s) { sx += s.dx; sy += s.dy; });
        const w = Math.hypot(sx, sy) * perPx() / (now - samples[0].t + 16);
        if (w > 0.0006) { self.inertia = { ax: sy, ay: sx, w: Math.min(w, MAX_FLING) }; schedule(); }
      }
      samples.length = 0;
      schedule(); // wake the loop: it sleeps during a drag, and auto-spin needs it again
      self.emit('dragend');
      if (!self.inertia) self.emit('settle');
    };

    c.addEventListener('pointerdown', function (e) {
      if (!self.opts.interactive) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // A fresh first touch: forget any finger we never heard back from.
      if (e.isPrimary && pts.size) pts.clear();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stopMotion();
      touch();
      if (pts.size === 1) { setDragging(true); moved = 0; pinched = false; samples.length = 0; self.emit('dragstart'); }
      else if (pts.size === 2) { pinch = dist2(); pinched = true; samples.length = 0; }
      // No focus() here: a mouse drag shouldn't leave a focus box on the model. Keyboard users reach it with Tab.
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      const p = pts.get(e.pointerId);
      if (!p) return;
      // The mouse button was let go somewhere we never heard about (another window, a pop-up menu…): stop dragging.
      if (e.pointerType === 'mouse' && !(e.buttons & 1)) { finish(e.pointerId, false); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!dx && !dy) return;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      touch();
      if (pts.size === 1 && !pinched) {
        self.rotateBy(dy, dx, 0, Math.hypot(dx, dy) * perPx(), true);
        const now = performance.now();
        samples.push({ t: now, dx: dx, dy: dy });
        while (samples.length > 1 && now - samples[0].t > 100) samples.shift();
      } else if (pts.size === 2) {
        // Pinch to zoom. After a pinch the model stays put until every finger is lifted, so it can't jump.
        const d = dist2();
        if (pinch > 0 && d > 0) self.setZoom(self.zoom * d / pinch);
        pinch = d;
      }
    });
    c.addEventListener('pointerup', function (e) { finish(e.pointerId, true); });
    // A cancelled touch (the page started scrolling) or lost capture never flicks.
    c.addEventListener('pointercancel', function (e) { finish(e.pointerId, false); });
    c.addEventListener('lostpointercapture', function (e) { finish(e.pointerId, false); });
    // Let go if the window loses focus mid-drag (Alt+Tab, a pop-up…), so the model never gets stuck to the mouse.
    const cancelAll = function () { Array.from(pts.keys()).forEach(function (id) { finish(id, false); }); };
    const onHide = function () { if (document.hidden) cancelAll(); };
    window.addEventListener('blur', cancelAll);
    document.addEventListener('visibilitychange', onHide);
    this._unbind = function () {
      window.removeEventListener('blur', cancelAll);
      document.removeEventListener('visibilitychange', onHide);
    };
    c.addEventListener('dblclick', function () {
      if (!self.opts.interactive) return;
      // Only a real double-click resets the view, not two quick drags in a row.
      if (moved > 6 || performance.now() - lastDragEnd < 600) return;
      self.resetView();
    });
    c.addEventListener('wheel', function (e) {
      if (!self.opts.interactive) return;
      // Plain scrolling always scrolls the page. Zoom needs Ctrl + scroll (or a trackpad pinch), or full screen.
      if (!e.ctrlKey && !self.isExpanded()) return;
      e.preventDefault();
      touch();
      self.setZoom(self.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
    }, { passive: false });
    c.addEventListener('keydown', function (e) {
      if (!self.opts.interactive) return;
      const step = 0.2;
      let handled = true;
      if (/^(Arrow|[+=_0rR-]$)/.test(e.key)) { stopMotion(); touch(); }
      switch (e.key) {
        case 'ArrowLeft': self.rotateBy(0, 1, 0, -step, true); break;
        case 'ArrowRight': self.rotateBy(0, 1, 0, step, true); break;
        case 'ArrowUp': self.rotateBy(1, 0, 0, -step, true); break;
        case 'ArrowDown': self.rotateBy(1, 0, 0, step, true); break;
        case '+': case '=': self.setZoom(self.zoom * 1.15); break;
        case '-': case '_': self.setZoom(self.zoom / 1.15); break;
        case '0': case 'r': case 'R': self.resetView(); break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); self.emit('dragstart'); self.emit('dragend'); self.emit('settle'); }
    });
  };

  Viewer.prototype._observe = function () {
    const self = this, target = this.canvas.parentElement || this.canvas;
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(target);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }
    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          self.visible = en.isIntersecting;
          if (self.visible) self.requestDraw();
        });
      }, { rootMargin: '120px' });
      this._io.observe(this.canvas);
    }
    this.resize();
  };
  Viewer.prototype.resize = function () {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (W !== c.width || H !== c.height || dpr !== this.dpr) {
      c.width = W; c.height = H; this.dpr = dpr;
      this.draw(performance.now());
    }
  };

  /* ---------- Drawing ---------- */
  Viewer.prototype.draw = function (t) {
    this.dirty = false;
    const ctx = this.ctx, c = this.canvas, W = c.width, H = c.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!this.mol || !W || !H) return;
    let zoom = this.zoom, alphaAll = 1;
    if (this.fade) {
      const p = this.fade.start ? Math.min(1, (t - this.fade.start) / this.fade.ms) : 0;
      const e = 1 - Math.pow(1 - p, 3);
      alphaAll = e;
      zoom *= 0.86 + 0.14 * e;
    }
    const R = this.frameR;
    const s = {
      k: (Math.min(W, H) / 2) * this.opts.fit / R * zoom,
      D: R * 6, cx: W / 2, cy: H / 2, dpr: this.dpr, R: R, t: t || 0
    };
    const items = [];
    this._collect(items, this.mol, this.q, false, s);
    if (this.ghost) this._collect(items, this.ghost.mol, this.ghost.follow ? this.q : this.ghost.q, true, s);
    items.sort(function (a, b) { return a.z - b.z; });
    const colors = theme();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'atom') this._drawAtom(ctx, it, s, colors, alphaAll);
      else this._drawStick(ctx, it, s, colors, alphaAll);
    }
    if (this.axis) this._drawAxis(ctx, s, colors, alphaAll);
    ctx.globalAlpha = 1;
  };

  Viewer.prototype._collect = function (items, mol, q, ghost, s) {
    const m = Q.toMat(q);
    const atoms = mol.atoms, n = atoms.length;
    const style = this.opts.style, showH = this.opts.showH;
    const X = new Array(n), Y = new Array(n), Z = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = atoms[i];
      X[i] = m[0] * a.x + m[1] * a.y + m[2] * a.z;
      Y[i] = m[3] * a.x + m[4] * a.y + m[5] * a.z;
      Z[i] = m[6] * a.x + m[7] * a.y + m[8] * a.z;
    }
    const hidden = function (i) { return !showH && atoms[i].el === 'H'; };
    const radiusOf = function (i) { const st = elStyle(atoms[i].el); return style === 'space' ? st.vdw : st.ball; };
    for (let i = 0; i < n; i++) {
      if (hidden(i)) continue;
      const sc = s.D / (s.D - Z[i]);
      items.push({
        kind: 'atom', z: Z[i], i: i, el: atoms[i].el, ghost: ghost,
        x: s.cx + X[i] * s.k * sc, y: s.cy - Y[i] * s.k * sc, r: radiusOf(i) * s.k * sc
      });
    }
    if (style === 'space') return;
    const self = this;
    const pushHalf = function (p1, p2, el, rad, fx) {
      const s1 = s.D / (s.D - p1[2]), s2 = s.D / (s.D - p2[2]);
      items.push({
        kind: 'stick', z: (p1[2] + p2[2]) / 2 - 0.001, el: el, ghost: ghost, fx: fx,
        x1: s.cx + p1[0] * s.k * s1, y1: s.cy - p1[1] * s.k * s1,
        x2: s.cx + p2[0] * s.k * s2, y2: s.cy - p2[1] * s.k * s2,
        w: rad * s.k * (s1 + s2)
      });
    };
    mol.bonds.forEach(function (bd) {
      if (hidden(bd.a) || hidden(bd.b)) return;
      const pa = [X[bd.a], Y[bd.a], Z[bd.a]], pb = [X[bd.b], Y[bd.b], Z[bd.b]];
      const u = V.norm(V.sub(pb, pa));
      let lines;
      if (bd.o === 2) {
        const off = self._doubleOffset(mol, bd, m);
        lines = [{ o: V.scale(off, 0.135), r: 0.075, pi: false }, { o: V.scale(off, -0.135), r: 0.075, pi: true }];
      } else if (bd.o >= 3) {
        let off = V.cross(u, [0, 0, 1]);
        off = V.len(off) < 1e-6 ? [1, 0, 0] : V.norm(off);
        lines = [{ o: [0, 0, 0], r: 0.068, pi: false }, { o: V.scale(off, 0.175), r: 0.062, pi: true }, { o: V.scale(off, -0.175), r: 0.062, pi: true }];
      } else {
        lines = [{ o: [0, 0, 0], r: 0.12, pi: false }];
      }
      // Start/end each stick at the ball surface so it never paints over the front of a ball.
      const ta = radiusOf(bd.a) * 0.82, tb = radiusOf(bd.b) * 0.82;
      lines.forEach(function (ln) {
        const a3 = V.add(V.add(pa, ln.o), V.scale(u, ta));
        const b3 = V.sub(V.add(pb, ln.o), V.scale(u, tb));
        const mid = V.scale(V.add(V.add(pa, ln.o), V.add(pb, ln.o)), 0.5);
        const fx = ln.pi ? bd.fx : null;
        pushHalf(a3, mid, atoms[bd.a].el, ln.r, fx);
        pushHalf(mid, b3, atoms[bd.b].el, ln.r, fx);
      });
    });
  };

  /** Direction (view space) to offset the two lines of a double bond: in the plane of its neighbours. */
  Viewer.prototype._doubleOffset = function (mol, bd, m) {
    const adj = G.adjacency(mol);
    const A = mol.atoms[bd.a], B = mol.atoms[bd.b];
    const u = V.norm([B.x - A.x, B.y - A.y, B.z - A.z]);
    const tryFrom = function (center, other) {
      const c = mol.atoms[center];
      for (let j = 0; j < adj[center].length; j++) {
        const nb = adj[center][j];
        if (nb.to === other) continue;
        const p = mol.atoms[nb.to];
        const d = [p.x - c.x, p.y - c.y, p.z - c.z];
        const perp = V.sub(d, V.scale(u, V.dot(d, u)));
        if (V.len(perp) > 0.05) return perp;
      }
      return null;
    };
    let ref = tryFrom(bd.a, bd.b) || tryFrom(bd.b, bd.a);
    if (!ref) ref = Math.abs(u[0]) < 0.9 ? V.cross(u, [1, 0, 0]) : V.cross(u, [0, 1, 0]);
    ref = V.norm(ref);
    return V.norm([
      m[0] * ref[0] + m[1] * ref[1] + m[2] * ref[2],
      m[3] * ref[0] + m[4] * ref[1] + m[5] * ref[2],
      m[6] * ref[0] + m[7] * ref[1] + m[8] * ref[2]
    ]);
  };

  Viewer.prototype._drawAtom = function (ctx, it, s, colors, alphaAll) {
    const sh = shade(it.el, fogLevel(it.z, s.R), colors.bg);
    const r = Math.max(1, it.r);
    ctx.beginPath();
    ctx.arc(it.x, it.y, r, 0, TAU);
    if (it.ghost) {
      ctx.globalAlpha = 0.2 * alphaAll;
      ctx.fillStyle = sh.base;
      ctx.fill();
      ctx.globalAlpha = 0.9 * alphaAll;
      ctx.setLineDash([4 * s.dpr, 3.5 * s.dpr]);
      ctx.lineWidth = 2 * s.dpr;
      ctx.strokeStyle = sh.dark;
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const g = ctx.createRadialGradient(it.x - r * 0.38, it.y - r * 0.42, r * 0.06, it.x, it.y, r);
    g.addColorStop(0, sh.light);
    g.addColorStop(0.42, sh.base);
    g.addColorStop(1, sh.dark);
    ctx.globalAlpha = alphaAll;
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.9 * s.dpr);
    ctx.strokeStyle = sh.rim;
    ctx.globalAlpha = 0.5 * alphaAll;
    ctx.stroke();
    // Small shine spot, so the atoms look glossy.
    if (r > 6) {
      const hx = it.x - r * 0.36, hy = it.y - r * 0.4, hr = r * 0.3;
      const shine = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      shine.addColorStop(0, 'rgba(255,255,255,0.75)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = alphaAll;
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, TAU);
      ctx.fill();
    }
    // In space-filling mode the H labels would cover the whole shape, so only heavier atoms get labels.
    if (this.opts.labels && !(it.el === 'H' && this.opts.style === 'space')) {
      const fs = Math.max(9 * s.dpr, Math.min(24 * s.dpr, r * 0.95));
      ctx.globalAlpha = alphaAll;
      ctx.fillStyle = elStyle(it.el).ink;
      ctx.font = '700 ' + Math.round(fs) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.el, it.x, it.y + fs * 0.05);
    }
    const hl = this.highlights && this.highlights[it.i];
    if (hl) {
      const p = this.pulse ? 0.5 + 0.5 * Math.sin(s.t / 160) : 1;
      ctx.globalAlpha = (0.4 + 0.6 * p) * alphaAll;
      ctx.strokeStyle = colors[hl] || hl;
      ctx.lineWidth = 3.5 * s.dpr;
      ctx.beginPath();
      ctx.arc(it.x, it.y, r + 5 * s.dpr + (this.pulse ? p * 3 * s.dpr : 0), 0, TAU);
      ctx.stroke();
    }
  };

  Viewer.prototype._drawStick = function (ctx, it, s, colors, alphaAll) {
    const dx = it.x2 - it.x1, dy = it.y2 - it.y1;
    const L = Math.hypot(dx, dy);
    const w = Math.max(1, it.w);
    ctx.lineCap = 'round';
    if (it.fx === 'broken') {
      ctx.globalAlpha = 0.9 * alphaAll;
      ctx.setLineDash([Math.max(2, w * 0.7), Math.max(2, w * 0.9)]);
      ctx.lineCap = 'butt';
      ctx.lineWidth = Math.max(1, w * 0.5);
      ctx.strokeStyle = colors.bad;
      ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const sh = it.fx === 'strained' ? colors.strain : shade(it.el, fogLevel(it.z, s.R), colors.bg);
    if (it.ghost) {
      ctx.globalAlpha = 0.3 * alphaAll;
      ctx.strokeStyle = sh.base;
      ctx.lineWidth = w * 0.6;
      ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
      return;
    }
    let paint = sh.base;
    if (L > 0.5) {
      let nx = -dy / L, ny = dx / L;
      if (nx + ny > 0) { nx = -nx; ny = -ny; } // point the lit edge up-left, like the balls
      const mx = (it.x1 + it.x2) / 2, my = (it.y1 + it.y2) / 2;
      const g = ctx.createLinearGradient(mx + nx * w / 2, my + ny * w / 2, mx - nx * w / 2, my - ny * w / 2);
      g.addColorStop(0, sh.base);
      g.addColorStop(0.3, sh.light);
      g.addColorStop(1, sh.dark);
      paint = g;
    }
    ctx.globalAlpha = alphaAll;
    ctx.strokeStyle = paint;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
  };

  Viewer.prototype._drawAxis = function (ctx, s, colors, alphaAll) {
    const A = this.mol.atoms[this.axis[0]], B = this.mol.atoms[this.axis[1]];
    const pa = Q.rotate(this.q, [A.x, A.y, A.z]), pb = Q.rotate(this.q, [B.x, B.y, B.z]);
    const u = V.norm(V.sub(pb, pa));
    const e1 = V.sub(pa, V.scale(u, 1.9)), e2 = V.add(pb, V.scale(u, 1.9));
    const proj = function (p) { const sc = s.D / (s.D - p[2]); return [s.cx + p[0] * s.k * sc, s.cy - p[1] * s.k * sc]; };
    const p1 = proj(e1), p2 = proj(e2);
    ctx.globalAlpha = 0.6 * alphaAll;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2.5 * s.dpr;
    ctx.lineCap = 'round';
    ctx.setLineDash([7 * s.dpr, 6 * s.dpr]);
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    ctx.setLineDash([]);
  };

  /* ---------- Keep several viewers turning together ---------- */
  function SyncGroup() { this.members = []; this.enabled = false; this.busy = false; }
  ISO.SyncGroup = SyncGroup;
  /** mirrored: this member spins like the mirror image of the others. */
  SyncGroup.prototype.add = function (viewer, mirrored) {
    const self = this, m = { v: viewer, mirrored: !!mirrored };
    this.members.push(m);
    viewer.on('rotate', function () { self._push(m); });
    viewer.on('zoom', function () { self._pushZoom(m); });
    // Grabbing one model stops the others gliding, so they never tug against each other.
    viewer.on('dragstart', function () {
      if (!self.enabled) return;
      self.members.forEach(function (o) { if (o !== m) { o.v.inertia = null; o.v.tween = null; } });
    });
    return this;
  };
  SyncGroup.prototype.setMirrored = function (viewer, on) {
    this.members.forEach(function (m) { if (m.v === viewer) m.mirrored = !!on; });
  };
  SyncGroup.prototype.setEnabled = function (on) {
    this.enabled = !!on;
    this.members.forEach(function (m, i) { m.v.spinSuppressed = !!on && i > 0; });
    if (on && this.members.length) { this._push(this.members[0]); this._pushZoom(this.members[0]); }
  };
  SyncGroup.prototype._push = function (src) {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    const canon = src.mirrored ? Q.mirror(src.v.q) : src.v.q;
    this.members.forEach(function (m) {
      if (m === src) return;
      // The model being moved leads; the others just follow it.
      m.v.inertia = null;
      m.v.tween = null;
      m.v.setRotation(m.mirrored ? Q.mirror(canon) : canon.slice(), true);
    });
    this.busy = false;
  };
  SyncGroup.prototype._pushZoom = function (src) {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    this.members.forEach(function (m) { if (m !== src) { m.v.zoom = src.v.zoom; m.v.requestDraw(); } });
    this.busy = false;
  };

  /* ---------- Viewer card (canvas + hint + full-screen button + caption) ---------- */
  ISO.makeViewerCard = function (opts) {
    opts = opts || {};
    const fig = document.createElement('figure');
    fig.className = 'viewer-card' + (opts.variant ? ' viewer-card--' + opts.variant : '') + (opts.className ? ' ' + opts.className : '');
    const wrap = document.createElement('div');
    wrap.className = 'viewer-wrap';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    wrap.appendChild(canvas);
    if (opts.fullscreen !== false) {
      const fsb = document.createElement('button');
      fsb.type = 'button';
      fsb.className = 'icon-btn viewer-fs';
      setFsButton(fsb, false);
      fsb.addEventListener('click', function () { ISO.toggleFullscreen(fig); });
      wrap.appendChild(fsb);
    }
    fig.appendChild(wrap);
    let nameEl = null, altEl = null;
    if (opts.caption !== false) {
      const cap = document.createElement('figcaption');
      cap.className = 'viewer-cap';
      nameEl = document.createElement('span'); nameEl.className = 'viewer-name';
      altEl = document.createElement('span'); altEl.className = 'viewer-alt';
      cap.appendChild(nameEl); cap.appendChild(altEl);
      fig.appendChild(cap);
    }
    if (opts.parent) opts.parent.appendChild(fig);
    const viewer = new Viewer(canvas, opts.viewer);
    viewer.on('dragstart', function () { fig.classList.add('touched'); });
    return {
      el: fig, wrap: wrap, canvas: canvas, viewer: viewer,
      setCaption: function (nameHTML, alt) {
        if (nameEl) nameEl.innerHTML = nameHTML;
        if (altEl) altEl.textContent = alt || '';
      }
    };
  };

  /* ---------- Full screen (with a CSS fallback for browsers without the API) ---------- */
  ISO.toggleFullscreen = function (el) {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl === el) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (el.classList.contains('is-expanded')) { collapse(el); return; }
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try {
        const p = req.call(el);
        if (p && p.catch) p.catch(function () { expand(el); });
      } catch (e) { expand(el); }
    } else expand(el);
  };
  function expand(el) { el.classList.add('is-expanded'); document.body.classList.add('has-expanded'); refreshFsButtons(); }
  function collapse(el) { el.classList.remove('is-expanded'); document.body.classList.remove('has-expanded'); refreshFsButtons(); }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.viewer-card.is-expanded').forEach(collapse);
  });
  /** The corner button shows an X ("Exit full screen") while its model is full screen. */
  function setFsButton(btn, on) {
    btn.innerHTML = ISO.ICONS ? (on ? ISO.ICONS.close : ISO.ICONS.expand) : (on ? '×' : '⤢');
    btn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    btn.title = on ? 'Exit full screen (Esc)' : 'Full screen';
  }
  function refreshFsButtons() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    document.querySelectorAll('.viewer-card').forEach(function (card) {
      const btn = card.querySelector('.viewer-fs');
      if (btn) setFsButton(btn, fsEl === card || card.classList.contains('is-expanded'));
    });
  }
  document.addEventListener('fullscreenchange', refreshFsButtons);
  document.addEventListener('webkitfullscreenchange', refreshFsButtons);
})();
