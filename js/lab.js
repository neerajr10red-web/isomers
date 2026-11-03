/* Isomers by Neeraj the Beloved — 3D Lab: Explore isomers · Spin the Bond · Mirror Challenge */
(function () {
  'use strict';
  const ISO = window.ISO;
  const G = ISO.geom, V = ISO.vec, Q = ISO.quat;
  const $ = function (id) { return document.getElementById(id); };
  const pressed = function (btn, on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  const P = function (a) { return [a.x, a.y, a.z]; };
  const say = function (id, html, tone) {
    const el = $(id);
    if (el.innerHTML === html) return; // same message: don't flash it again
    el.className = 'status' + (tone ? ' ' + tone : '');
    el.innerHTML = html;
    void el.offsetWidth; // restart the fade-in
    el.classList.add('pop');
  };

  /* =========================================================
     EXPLORE: every isomer of a formula, side by side
     ========================================================= */
  const Explore = {
    st: { style: 'ball', showH: true, labels: false, sync: false },
    cards: [],
    group: null,

    init: function (firstSet) {
      const self = this, st = this.st;
      ISO.SETS.forEach(function (set) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.set = set.id;
        b.innerHTML = set.id === 'mirror' ? 'Mirror pairs' : ISO.formulaHTML(set.title);
        if (set.id !== 'mirror') b.setAttribute('aria-label', set.title); // read out as "C4H10"
        b.addEventListener('click', function () { self.showSet(set.id); });
        $('set-picker').appendChild(b);
      });
      const styleBtns = $('style-picker').querySelectorAll('[data-style]');
      styleBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          st.style = b.dataset.style;
          styleBtns.forEach(function (x) { pressed(x, x === b); });
          self.each(function (v) { v.setStyle(st.style); });
        });
      });
      $('opt-h').addEventListener('change', function (e) { st.showH = e.target.checked; self.each(function (v) { v.setShowH(st.showH); }); });
      $('opt-labels').addEventListener('change', function (e) { st.labels = e.target.checked; self.each(function (v) { v.setLabels(st.labels); }); });
      $('opt-sync').addEventListener('change', function (e) { st.sync = e.target.checked; if (self.group) self.group.setEnabled(st.sync); });
      // Browsers can keep checkboxes ticked after a reload, so start from what the page shows.
      st.showH = $('opt-h').checked;
      st.labels = $('opt-labels').checked;
      st.sync = $('opt-sync').checked;
      this.showSet(firstSet || ISO.SETS[0].id);
    },

    each: function (fn) { this.cards.forEach(function (c) { fn(c.viewer); }); },

    showSet: function (id) {
      const self = this, st = this.st;
      const set = ISO.SETS.filter(function (s) { return s.id === id; })[0];
      if (!set) return;
      $('set-picker').querySelectorAll('button').forEach(function (b) { pressed(b, b.dataset.set === id); });
      const isMirror = set.id === 'mirror';
      $('set-title').innerHTML = isMirror ? 'Mirror pairs' : ISO.formulaHTML(set.title);
      $('set-count').textContent = isMirror ? (set.ids.length / 2) + ' pairs' : set.ids.length + ' isomers';
      $('set-tip').textContent = 'Try this: ' + set.tip;

      this.cards.forEach(function (c) { c.viewer.destroy(); c.el.remove(); });
      const grid = $('explore-grid');
      grid.dataset.count = set.ids.length;
      const mols = set.ids.map(ISO.get);
      this.group = new ISO.SyncGroup();
      this.cards = set.ids.map(function (mid, i) {
        const mol = mols[i];
        const mirrored = !!(set.mirrored && set.mirrored[i]);
        const card = ISO.makeViewerCard({ parent: grid, viewer: { style: st.style, showH: st.showH, labels: st.labels } });
        card.setCaption(ISO.escape(mol.name), mol.alt);
        // Mirror forms start facing as reflections of their partner.
        if (mirrored) card.viewer.initialQ = Q.mirror(card.viewer.initialQ);
        // Same scale for the whole set (or for each mirror pair), so sizes can be compared.
        card.viewer.setMolecule(mol, { frame: isMirror ? [mols[i], mols[i ^ 1]] : mols, transition: true });
        self.group.add(card.viewer, mirrored);
        return card;
      });
      this.group.setEnabled(st.sync);
    }
  };

  /* =========================================================
     SPIN THE BOND: single vs double vs triple
     ========================================================= */
  const SPIN = [
    { id: 'butane', label: 'Butane', sym: 'C–C', kind: 'single' },
    { id: 'cis-but-2-ene', label: 'But-2-ene', sym: 'C=C', kind: 'double' },
    { id: 'methylpropene', label: '2-Methylpropene', sym: 'C=C', kind: 'double' },
    { id: 'but-2-yne', label: 'But-2-yne', sym: 'C≡C', kind: 'triple' }
  ];
  const INTRO = {
    single: '<p>Drag the slider or press Spin it. Watch the CH₃ groups at each end.</p>',
    double: '<p>Try to twist it with the slider.</p>',
    triple: '<p>Twist it and watch the carbon chain.</p>'
  };
  const SINGLE_MSG = '<p><b>Still butane.</b> Single bonds spin freely, so the CH₃ groups being on the same side or on opposite sides doesn’t make a different molecule.</p>';
  const LOCK_MSG = '<p><b>It won’t turn.</b> Twisting a double bond would break its second bond (the π bond), so it snaps back. The groups are stuck on their sides, which is why cis and trans isomers exist.</p>';
  const TRIPLE_MSG = '<p><b>Nothing changes.</b> The four carbons are in a straight line, so each triple-bond carbon has only one other group. There’s no “same side” or “opposite side”, so no cis/trans.</p>';

  function groupLabel(mol, i) {
    const a = mol.atoms[i];
    if (a.el !== 'C') return a.el;
    const hs = G.adjacency(mol)[i].filter(function (n) { return mol.atoms[n.to].el === 'H'; }).length;
    return ['C', 'CH', 'CH₂', 'CH₃'][hs] || 'C';
  }
  /** How many atoms of `mol` sit where an atom of the same element sits in `ref`. */
  function matchCount(mol, ref, tol) {
    tol = tol || 0.35;
    let count = 0;
    const missing = [];
    mol.atoms.forEach(function (a, i) {
      const hit = ref.atoms.some(function (b) {
        return b.el === a.el && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < tol;
      });
      if (hit) count++; else missing.push(i);
    });
    return { count: count, missing: missing };
  }

  const Spin = {
    s: null,
    card: null,
    cancel: null,
    flipping: false,

    init: function () {
      const self = this;
      SPIN.forEach(function (d) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.id = d.id;
        b.textContent = d.label + ' (' + d.sym + ')';
        b.addEventListener('click', function () { self.load(d.id); });
        $('spin-picker').appendChild(b);
      });
      this.card = ISO.makeViewerCard({ parent: $('spin-stage'), variant: 'wide', caption: false });
      const slider = $('twist');
      slider.addEventListener('input', function () { self.onSlide(+slider.value); });
      slider.addEventListener('change', function () { self.onRelease(); });
      $('spin-play').addEventListener('click', function () { self.play(); });
      $('spin-flip').addEventListener('click', function () { self.flip(); });
      $('spin-reset').addEventListener('click', function () { self.load(self.s.def.id); });
      this.load('butane');
    },

    load: function (id) {
      this.stop();
      this.flipping = false;
      this.buttons(true);
      const def = SPIN.filter(function (d) { return d.id === id; })[0];
      const mol = ISO.fresh(id);
      const pair = G.twistBond(mol);
      let a = pair[0], b = pair[1];
      let side = G.side(mol, a, b);
      const other = G.side(mol, b, a);
      if (other && side && other.length < side.length) { side = other; const t = a; a = b; b = t; }
      const adj = G.adjacency(mol);
      const nb = function (center, not) {
        const list = adj[center].filter(function (n) { return n.to !== not; });
        const heavy = list.filter(function (n) { return mol.atoms[n.to].el !== 'H'; });
        return (heavy[0] || list[0]).to;
      };
      this.s = {
        def: def, mol: mol, a: a, b: b, side: side,
        base: G.clone(mol).atoms, n1: nb(a, b), n2: nb(b, a),
        bond: mol.bonds.filter(function (bd) { return (bd.a === a && bd.b === b) || (bd.a === b && bd.b === a); })[0],
        twist: 0, flipped: false, warned: false, spunMsg: false
      };
      const v = this.card.viewer;
      v.setMolecule(mol, { frame: [mol], transition: true });
      v.setGhost(null);
      v.setAxis([a, b]);
      v.setHighlights(this.marks());
      $('spin-picker').querySelectorAll('button').forEach(function (x) { pressed(x, x.dataset.id === id); });
      this.setSlider(0);
      $('spin-flip').hidden = def.kind !== 'double';
      this.title();
      this.readout();
      say('spin-status', INTRO[def.kind]);
    },

    marks: function () {
      const m = {};
      m[this.s.a] = 'ink';
      m[this.s.b] = 'ink';
      return m;
    },

    title: function () {
      const s = this.s;
      let name = ISO.get(s.def.id).name;
      if (s.def.id === 'cis-but-2-ene' && s.flipped) name = ISO.get('trans-but-2-ene').name;
      s.mol.name = name;
      this.card.viewer._label();
      $('spin-name').textContent = name;
      $('spin-sub').innerHTML = ISO.formulaHTML(s.mol.formula) + ', twisting the ' + s.def.sym + ' bond';
    },

    readout: function () {
      const s = this.s;
      let html = '';
      if (s.def.id === 'butane' || s.def.id === 'cis-but-2-ene') {
        const d = Math.abs(G.dihedral(s.mol, s.n1, s.a, s.b, s.n2));
        html += '<p>CH₃ groups: <b>' + (d < 90 ? 'same side' : 'opposite sides') + '</b> (' + Math.round(d) + '° apart)</p>';
      }
      if (s.def.kind === 'double') {
        const adj = G.adjacency(s.mol);
        const groups = function (c, partner) {
          return adj[c].filter(function (n) { return n.to !== partner; }).map(function (n) { return groupLabel(s.mol, n.to); });
        };
        const fmt = function (g) {
          return '<b>' + g.join(' + ') + '</b> (' + (g[0] === g[1] ? 'identical' : 'different') + ')';
        };
        html += '<p>One C=C carbon has ' + fmt(groups(s.a, s.b)) + '</p>';
        html += '<p>The other has ' + fmt(groups(s.b, s.a)) + '</p>';
      }
      if (s.def.kind === 'triple') html += '<p>The four carbons are in a straight line.</p>';
      $('spin-readout').innerHTML = html;
    },

    buttons: function (on) {
      ['spin-play', 'spin-flip', 'twist'].forEach(function (id) { $(id).disabled = !on; });
    },

    stop: function () {
      if (this.cancel) { this.cancel(); this.cancel = null; }
    },

    apply: function (deg) {
      const s = this.s;
      s.twist = deg;
      G.rotateAbout(s.mol, s.side, s.a, s.b, deg * Math.PI / 180, s.base);
      this.card.viewer.requestDraw();
      this.readout();
    },

    setSlider: function (v) {
      $('twist').value = v;
      $('twist-out').textContent = Math.round(v) + '°';
    },

    onSlide: function (v) {
      const s = this.s;
      this.stop();
      $('twist-out').textContent = v + '°';
      if (s.def.kind === 'double') {
        s.bond.fx = Math.abs(v) > 4 ? 'strained' : null;
        this.apply(13 * Math.tanh(v / 13)); // it barely moves, however far you pull
        if (!s.warned && Math.abs(v) > 20) {
          s.warned = true;
          say('spin-status', '<p><b>It won’t budge.</b> Let go and see what happens.</p>', 'warn');
        }
      } else {
        this.apply(v);
        if (!s.spunMsg && Math.abs(v) > 60) {
          s.spunMsg = true;
          say('spin-status', s.def.kind === 'single' ? SINGLE_MSG : TRIPLE_MSG, 'good');
        }
      }
    },

    onRelease: function () {
      const s = this.s, self = this;
      if (s.def.kind !== 'double') return;
      const from = +$('twist').value, shown = s.twist;
      this.cancel = ISO.animate(560, function (p) {
        self.setSlider(from * (1 - p));
        self.apply(shown * (1 - p));
      }, function () {
        s.bond.fx = null;
        self.setSlider(0);
        self.apply(0);
      }, ISO.ease.outBack);
      say('spin-status', LOCK_MSG, 'warn');
    },

    play: function () {
      const s = this.s, self = this;
      this.stop();
      if (s.def.kind === 'double') {
        this.cancel = ISO.animate(1100, function (p) {
          s.bond.fx = 'strained';
          self.apply(13 * Math.sin(p * Math.PI * 6) * (1 - p));
        }, function () {
          s.bond.fx = null;
          self.apply(0);
        }, function (t) { return t; });
        say('spin-status', LOCK_MSG, 'warn');
        return;
      }
      const start = s.twist;
      this.cancel = ISO.animate(2800, function (p) {
        const deg = start + 360 * p;
        self.apply(deg);
        self.setSlider((((Math.round(deg) + 180) % 360) + 360) % 360 - 180);
      }, null, ISO.ease.inOut);
      say('spin-status', s.def.kind === 'single' ? SINGLE_MSG : TRIPLE_MSG, 'good');
    },

    flip: function () {
      const s = this.s, self = this, v = this.card.viewer;
      if (s.def.kind !== 'double' || this.flipping) return;
      this.stop();
      s.bond.fx = null;
      this.apply(0);
      this.setSlider(0);
      const before = G.clone(s.mol);
      v.setGhost(null);
      v.setHighlights(this.marks());
      s.bond.fx = 'broken';
      this.flipping = true;
      this.buttons(false);
      say('spin-status', '<p><b>Breaking the π bond…</b> In real life this needs a lot of energy, like strong heat or UV light.</p>', 'warn');
      this.cancel = ISO.animate(1700, function (p) { self.apply(180 * p); }, function () {
        self.cancel = null;
        s.bond.fx = null;
        s.base = G.clone(s.mol).atoms; // the flipped shape is the new starting point
        s.twist = 0;
        s.flipped = !s.flipped;
        self.flipping = false;
        self.buttons(true);
        const res = matchCount(s.mol, before);
        v.setGhost(before, { follow: true });
        const hl = self.marks();
        res.missing.forEach(function (i) { hl[i] = 'bad'; });
        v.setHighlights(hl, res.missing.length > 0);
        self.title();
        self.readout();
        const total = s.mol.atoms.length;
        if (res.count === total) {
          say('spin-status', '<p><b>Same molecule.</b> All ' + total + ' atoms line up with the dashed copy of where they started. ' +
            'The two H atoms just swapped places, so a carbon with two identical groups can’t make cis/trans isomers.</p>', 'good');
        } else {
          say('spin-status', '<p><b>Now it’s ' + ISO.escape(ISO.lowerName(s.mol.name)) + ', a different molecule.</b> Only ' + res.count + ' of ' + total +
            ' atoms line up with the dashed copy of where they started (the circled ones moved).</p>', 'bad');
        }
      }, ISO.ease.inOut);
    }
  };

  /* =========================================================
     MIRROR CHALLENGE: stack CHBrClF on a copy, then on its mirror image
     ========================================================= */
  const ORDER = ['C', 'Br', 'Cl', 'F', 'H'];
  const TOL = 24 * Math.PI / 180;   // counts as lined up
  const SNAP = 40 * Math.PI / 180;  // close enough to snap into place (round 1)

  const Mirror = {
    init: function () {
      const self = this;
      const t = ISO.fresh('chbrclf');
      G.centerOn(t, t.atoms.findIndex(function (a) { return a.el === 'C'; }));
      t.name = 'Target CHBrClF';
      this.target = t;
      this.ghostQ = Q.normalize(Q.mul(Q.fromAxisAngle(1, 0, 0, 0.5), Q.fromAxisAngle(0, 1, 0, 0.7)));
      this.card = ISO.makeViewerCard({ parent: $('mirror-stage'), variant: 'wide', className: 'viewer-card--challenge', caption: false, viewer: { labels: true } });
      const v = this.card.viewer;
      v.on('rotate', function () { self.update(); });
      v.on('settle', function () { self.settled(); });

      this.chips = {};
      ORDER.forEach(function (el) {
        const st = ISO.ELEMENTS[el];
        const c = document.createElement('span');
        c.className = 'atom-chip';
        c.textContent = el;
        c.style.background = st.color;
        c.style.color = st.ink;
        c.title = st.name;
        $('match-meter').appendChild(c);
        self.chips[el] = c;
      });
      $('round-picker').querySelectorAll('[data-round]').forEach(function (b) {
        b.addEventListener('click', function () { self.start(b.dataset.round); });
      });
      $('mirror-shuffle').addEventListener('click', function () { self.shuffle(); });
      $('mirror-show').addEventListener('click', function () { self.showMe(); });
      this.start('copy');
    },

    start: function (round) {
      this.round = round;
      $('round-picker').querySelectorAll('[data-round]').forEach(function (b) { pressed(b, b.dataset.round === round); });
      this.user = round === 'copy' ? G.clone(this.target) : G.mirror(this.target);
      this.user.name = round === 'copy' ? 'Your molecule: a turned copy of CHBrClF' : 'Your molecule: the mirror image of CHBrClF';
      this.user.formula = 'CHBrClF';
      const v = this.card.viewer;
      v.setMolecule(this.user, { frame: [this.target] });
      v.setGhost(this.target, { q: this.ghostQ });
      this.shuffle(true);
    },

    intro: function () {
      say('mirror-status', this.round === 'copy'
        ? '<p><b>Round 1.</b> Your molecule is an exact copy, just turned around. Drag it until all 5 atoms are in their dashed circles.</p>'
        : '<p><b>Round 2.</b> Now yours is the mirror image: same atoms and bonds, just reflected. Try to line up all 5.</p>');
    },

    shuffle: function (instant) {
      const v = this.card.viewer;
      let q, tries = 0;
      do { q = Q.random(); tries++; } while (this.score(q).count > 2 && tries < 50);
      this.done = false;
      this.revealed = false;
      this.hits3 = 0;
      v.setHighlights(null);
      if (instant || ISO.reducedMotion) v.setRotation(q); else v.animateTo(q, 550);
      this.intro();
    },

    score: function (q) {
      const self = this;
      const matched = { C: true }, angles = {};
      let count = 1;
      this.user.atoms.forEach(function (a) {
        if (a.el === 'C') return;
        const t = self.target.atoms.filter(function (b) { return b.el === a.el; })[0];
        const ang = V.angle(Q.rotate(q, P(a)), Q.rotate(self.ghostQ, P(t)));
        angles[a.el] = ang;
        if (ang < TOL) { matched[a.el] = true; count++; }
      });
      return { count: count, matched: matched, angles: angles };
    },

    update: function () {
      const self = this;
      const r = this.score(this.card.viewer.q);
      ORDER.forEach(function (el) { self.chips[el].classList.toggle('on', !!r.matched[el]); });
      $('match-score').textContent = r.count;
      if (this.round === 'copy' && !this.done && r.count === 5) this.win();
    },

    settled: function () {
      const self = this;
      const r = this.score(this.card.viewer.q);
      if (this.round === 'copy') {
        if (this.done) return;
        const close = ['Br', 'Cl', 'F', 'H'].every(function (el) { return r.angles[el] < SNAP; });
        if (close) this.card.viewer.animateTo(this.ghostQ, 450, function () { self.win(); });
      } else if (!this.revealed && r.count >= 3) {
        this.hits3++;
        say('mirror-status', this.hits3 === 1
          ? '<p><b>3 out of 5.</b> Two more to go…</p>'
          : '<p><b>3 out of 5 again.</b> Every time two groups line up, the other two end up swapped. Press Show me if you give up.</p>', 'warn');
      }
    },

    win: function () {
      if (this.done) return;
      this.done = true;
      const self = this;
      say('mirror-status', '<p><b>5 out of 5.</b> A turned copy is still the same molecule.</p>' +
        '<p><button type="button" class="btn primary" id="go-round2">Try Round 2</button></p>', 'good');
      $('go-round2').addEventListener('click', function () { self.start('mirror'); });
    },

    showMe: function () {
      const v = this.card.viewer, self = this;
      if (this.round === 'copy') {
        v.animateTo(this.ghostQ, 900, function () { self.win(); });
        return;
      }
      const find = function (mol, el) { return mol.atoms.filter(function (a) { return a.el === el; })[0]; };
      // The best try: line up Br and Cl exactly, then see where F and H end up.
      const best = Q.alignTwo(
        P(find(this.user, 'Br')), P(find(this.user, 'Cl')),
        Q.rotate(this.ghostQ, P(find(this.target, 'Br'))), Q.rotate(this.ghostQ, P(find(this.target, 'Cl'))));
      v.setHighlights(null);
      // Passing true: the explanation still appears if someone grabs the model mid-animation.
      v.animateTo(best, 1000, function () {
        const hl = {};
        self.user.atoms.forEach(function (a, i) { if (a.el === 'H' || a.el === 'F') hl[i] = 'bad'; });
        v.setHighlights(hl, true);
        self.revealed = true;
        say('mirror-status', '<p><b>3 out of 5 is the best anyone can do.</b> Line up any two groups and the other two (circled) are always swapped. ' +
          'Mirror images that can’t be stacked are called enantiomers, like your left and right hands.</p>' +
          '<p class="muted">Even the Great Neeraj can’t do it. He tried.</p>', 'bad');
      }, true);
    }
  };

  /* ---------- Start each tab the first time it's opened ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    // A link like lab.html#c4h8 opens Explore on that formula.
    const hash = (location.hash || '').slice(1);
    const startSet = ISO.SETS.some(function (s) { return s.id === hash; }) ? hash : null;
    const mods = {
      explore: function () { Explore.init(startSet); },
      spin: function () { Spin.init(); },
      mirror: function () { Mirror.init(); }
    };
    const started = {};
    ISO.initTabs(document.querySelector('.tabs'), function (tab) {
      if (!started[tab] && mods[tab]) { started[tab] = true; mods[tab](); }
    });
  });
})();
