/* Isomers by Neeraj the Beloved — molecule library.
   3D coordinates come from structures.js (PubChem). This file adds names,
   formulas, isomer relationships and the geometry helpers the models use. */
(function () {
  'use strict';
  const ISO = window.ISO = window.ISO || {};
  const RAW = ISO.STRUCTURES || {};

  /* ---------- Vector helpers ([x, y, z] arrays) ---------- */
  const V = ISO.vec = {
    sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
    add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
    scale: function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
    dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
    cross: function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
    len: function (a) { return Math.hypot(a[0], a[1], a[2]); },
    norm: function (a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    angle: function (a, b) {
      const d = V.dot(V.norm(a), V.norm(b));
      return Math.acos(Math.max(-1, Math.min(1, d)));
    }
  };
  const P = function (atom) { return [atom.x, atom.y, atom.z]; };

  /* ---------- Geometry on molecules {atoms:[{el,x,y,z}], bonds:[{a,b,o}]} ---------- */
  const G = ISO.geom = {
    fromRaw: function (raw) {
      return {
        atoms: raw.atoms.map(function (a) { return { el: a[0], x: a[1], y: a[2], z: a[3] }; }),
        bonds: raw.bonds.map(function (b) { return { a: b[0], b: b[1], o: b[2] }; })
      };
    },
    clone: function (mol) {
      return {
        atoms: mol.atoms.map(function (a) { return { el: a.el, x: a.x, y: a.y, z: a.z }; }),
        bonds: mol.bonds.map(function (b) { return { a: b.a, b: b.b, o: b.o }; })
      };
    },
    /** Neighbour lists, cached on the molecule (bonds never change after creation). */
    adjacency: function (mol) {
      if (!mol._adj) {
        const adj = mol.atoms.map(function () { return []; });
        mol.bonds.forEach(function (b, k) {
          adj[b.a].push({ to: b.b, o: b.o, k: k });
          adj[b.b].push({ to: b.a, o: b.o, k: k });
        });
        Object.defineProperty(mol, '_adj', { value: adj, enumerable: false, configurable: true });
      }
      return mol._adj;
    },
    /** Atoms on b's side of bond a–b (including b). Returns null if the bond is in a ring. */
    side: function (mol, a, b) {
      const adj = G.adjacency(mol);
      const seen = new Set([b]);
      const stack = [b];
      while (stack.length) {
        const i = stack.pop();
        for (let n = 0; n < adj[i].length; n++) {
          const to = adj[i][n].to;
          if (i === b && to === a) continue;
          if (to === a) return null;
          if (!seen.has(to)) { seen.add(to); stack.push(to); }
        }
      }
      return Array.from(seen);
    },
    /** Rotates atoms `idxs` about the axis through atoms a -> b by `angle` radians.
        If `base` (a saved copy of the atoms) is given, rotation starts from those positions. */
    rotateAbout: function (mol, idxs, a, b, angle, base) {
      const src = base || mol.atoms;
      const A = P(src[a]), B = P(src[b]);
      const u = V.norm(V.sub(B, A));
      const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
      const ux = u[0], uy = u[1], uz = u[2];
      const m = [
        t * ux * ux + c, t * ux * uy - s * uz, t * ux * uz + s * uy,
        t * ux * uy + s * uz, t * uy * uy + c, t * uy * uz - s * ux,
        t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c
      ];
      idxs.forEach(function (i) {
        const p = src[i];
        const x = p.x - B[0], y = p.y - B[1], z = p.z - B[2];
        const dst = mol.atoms[i];
        dst.x = B[0] + m[0] * x + m[1] * y + m[2] * z;
        dst.y = B[1] + m[3] * x + m[4] * y + m[5] * z;
        dst.z = B[2] + m[6] * x + m[7] * y + m[8] * z;
      });
    },
    /** Torsion angle i–j–k–l in degrees (-180..180). */
    dihedral: function (mol, i, j, k, l) {
      const p1 = P(mol.atoms[i]), p2 = P(mol.atoms[j]), p3 = P(mol.atoms[k]), p4 = P(mol.atoms[l]);
      const b1 = V.sub(p2, p1), b2 = V.sub(p3, p2), b3 = V.sub(p4, p3);
      const n1 = V.cross(b1, b2), n2 = V.cross(b2, b3);
      const m1 = V.cross(n1, V.norm(b2));
      const x = V.dot(n1, n2), y = V.dot(m1, n2);
      return Math.atan2(y, x) * 180 / Math.PI;
    },
    /** Molecular formula in Hill order: C, H, then the rest alphabetically. */
    formula: function (mol) {
      const n = {};
      mol.atoms.forEach(function (a) { n[a.el] = (n[a.el] || 0) + 1; });
      const part = function (el) { return el + (n[el] > 1 ? n[el] : ''); };
      let out = '';
      if (n.C) { out += part('C'); if (n.H) out += part('H'); }
      Object.keys(n).filter(function (el) { return !(n.C && (el === 'C' || el === 'H')); }).sort().forEach(function (el) { out += part(el); });
      return out;
    },
    counts: function (mol) {
      const n = {};
      mol.atoms.forEach(function (a) { n[a.el] = (n[a.el] || 0) + 1; });
      return n;
    },
    /** Mirror image: reflect through the y–z plane (x -> -x). */
    mirror: function (mol) {
      const m = G.clone(mol);
      m.atoms.forEach(function (a) { a.x = -a.x; });
      return m;
    },
    /** Moves the molecule so atom `idx` (or the centre of all atoms) sits at the origin. */
    centerOn: function (mol, idx) {
      let c;
      if (idx == null) {
        c = [0, 0, 0];
        mol.atoms.forEach(function (a) { c[0] += a.x; c[1] += a.y; c[2] += a.z; });
        c = V.scale(c, 1 / mol.atoms.length);
      } else c = P(mol.atoms[idx]);
      mol.atoms.forEach(function (a) { a.x -= c[0]; a.y -= c[1]; a.z -= c[2]; });
      return mol;
    },
    /** Radius of the smallest origin-centred sphere holding every atom centre. */
    radius: function (mol) {
      let r = 0;
      mol.atoms.forEach(function (a) { r = Math.max(r, Math.hypot(a.x, a.y, a.z)); });
      return r;
    },
    heavyDegree: function (mol, i) {
      return G.adjacency(mol)[i].filter(function (n) { return mol.atoms[n.to].el !== 'H'; }).length;
    },
    /** The bond the "Spin the Bond" demo twists: the C=C or C≡C if there is one,
        otherwise the middle C–C single bond. Returns [a, b]. */
    twistBond: function (mol) {
      let best = null, bestScore = -1;
      mol.bonds.forEach(function (bd) {
        if (mol.atoms[bd.a].el !== 'C' || mol.atoms[bd.b].el !== 'C') return;
        const score = bd.o * 10 + Math.min(G.heavyDegree(mol, bd.a), G.heavyDegree(mol, bd.b));
        if (score > bestScore) { bestScore = score; best = [bd.a, bd.b]; }
      });
      return best;
    },
    /** R or S for a stereocentre, given neighbour indices in priority order (highest first, 3 needed). */
    chirality: function (mol, center, prio) {
      const c = P(mol.atoms[center]);
      const v1 = V.sub(P(mol.atoms[prio[0]]), c);
      const v2 = V.sub(P(mol.atoms[prio[1]]), c);
      const v3 = V.sub(P(mol.atoms[prio[2]]), c);
      return V.dot(V.cross(v1, v2), v3) < 0 ? 'R' : 'S';
    }
  };

  /* ---------- The library ----------
     con:    constitution id. Same con = same atoms connected in the same order.
     stereo: {t: 'ct', v: 'cis'|'trans'} for cis/trans, {t: 'rs', v: 'R'|'S'} for mirror forms.
     desc:   short description of the connections, shown as evidence in the Isomer Finder. */
  const LIB = [
    { id: 'butane', name: 'Butane', con: 'butane', desc: '4 carbons in one straight chain' },
    { id: 'butane-twisted', name: 'Butane (twisted)', src: 'butane', op: { twist: 120 }, con: 'butane', twisted: true,
      alt: 'just spun around its middle single bond', desc: '4 carbons in one straight chain' },
    { id: 'isobutane', name: '2-Methylpropane', alt: 'isobutane', con: '2-methylpropane', desc: '3-carbon chain with a CH₃ branch on carbon 2' },

    { id: 'pentane', name: 'Pentane', con: 'pentane', desc: '5 carbons in one straight chain' },
    { id: 'isopentane', name: '2-Methylbutane', alt: 'isopentane', con: '2-methylbutane', desc: '4-carbon chain with a CH₃ branch on carbon 2' },
    { id: 'neopentane', name: '2,2-Dimethylpropane', alt: 'neopentane', con: '2,2-dimethylpropane', desc: '3-carbon chain with two CH₃ branches on carbon 2' },

    { id: 'hexane', name: 'Hexane', con: 'hexane', desc: '6 carbons in one straight chain' },
    { id: '2-methylpentane', name: '2-Methylpentane', con: '2-methylpentane', desc: '5-carbon chain with a CH₃ branch on carbon 2' },
    { id: '3-methylpentane', name: '3-Methylpentane', con: '3-methylpentane', desc: '5-carbon chain with a CH₃ branch on carbon 3' },
    { id: '22-dimethylbutane', name: '2,2-Dimethylbutane', con: '2,2-dimethylbutane', desc: '4-carbon chain with two CH₃ branches on carbon 2' },
    { id: '23-dimethylbutane', name: '2,3-Dimethylbutane', con: '2,3-dimethylbutane', desc: '4-carbon chain with CH₃ branches on carbons 2 and 3' },

    { id: 'but-1-ene', name: 'But-1-ene', alt: '1-butene', con: 'but-1-ene', desc: '4-carbon chain with the C=C at the end (carbon 1)' },
    { id: 'cis-but-2-ene', name: 'cis-But-2-ene', alt: 'cis-2-butene', con: 'but-2-ene', stereo: { t: 'ct', v: 'cis' }, desc: '4-carbon chain with the C=C in the middle' },
    { id: 'trans-but-2-ene', name: 'trans-But-2-ene', alt: 'trans-2-butene', con: 'but-2-ene', stereo: { t: 'ct', v: 'trans' }, desc: '4-carbon chain with the C=C in the middle' },
    { id: 'methylpropene', name: '2-Methylpropene', alt: 'isobutylene', con: '2-methylpropene', desc: '3-carbon chain with a C=C and a CH₃ branch on carbon 2' },
    { id: 'cyclobutane', name: 'Cyclobutane', con: 'cyclobutane', desc: '4 carbons joined in a ring' },
    { id: 'methylcyclopropane', name: 'Methylcyclopropane', con: 'methylcyclopropane', desc: '3-carbon ring with a CH₃ branch' },

    { id: '11-dce', name: '1,1-Dichloroethene', con: '1,1-dichloroethene', desc: 'C=C with both Cl atoms on the same carbon' },
    { id: 'cis-12-dce', name: 'cis-1,2-Dichloroethene', con: '1,2-dichloroethene', stereo: { t: 'ct', v: 'cis' }, desc: 'C=C with one Cl atom on each carbon' },
    { id: 'trans-12-dce', name: 'trans-1,2-Dichloroethene', con: '1,2-dichloroethene', stereo: { t: 'ct', v: 'trans' }, desc: 'C=C with one Cl atom on each carbon' },

    { id: 'ethanol', name: 'Ethanol', con: 'ethanol', desc: 'C–C–O: the O is at the end, as an –OH group' },
    { id: 'dimethyl-ether', name: 'Methoxymethane', alt: 'dimethyl ether', con: 'methoxymethane', desc: 'C–O–C: the O sits between the two carbons' },

    { id: 'but-2-yne', name: 'But-2-yne', alt: '2-butyne', con: 'but-2-yne', desc: '4-carbon chain with a C≡C triple bond in the middle' },

    { id: 'chbrclf', name: 'Bromochlorofluoromethane', alt: 'CHBrClF', con: 'chbrclf', stereo: { t: 'rs', v: '?' }, desc: 'one carbon holding H, F, Cl and Br' },
    { id: 'chbrclf-mirror', name: 'Bromochlorofluoromethane', alt: 'CHBrClF, mirror image', src: 'chbrclf', op: { mirror: true }, con: 'chbrclf', stereo: { t: 'rs', v: '?' }, desc: 'one carbon holding H, F, Cl and Br' },

    { id: 'r-butan-2-ol', name: '(R)-Butan-2-ol', con: 'butan-2-ol', stereo: { t: 'rs', v: 'R' }, desc: '4-carbon chain with an –OH on carbon 2' },
    { id: 's-butan-2-ol', name: '(S)-Butan-2-ol', alt: 'mirror image of (R)', src: 'r-butan-2-ol', op: { mirror: true }, con: 'butan-2-ol', stereo: { t: 'rs', v: 'S' }, desc: '4-carbon chain with an –OH on carbon 2' },
    { id: 'r-carvone', name: '(R)-Carvone', alt: 'smells like spearmint', con: 'carvone', stereo: { t: 'rs', v: 'R' }, desc: 'six-carbon ring with a C=O, a CH₃ and a C(=CH₂)CH₃ group' },
    { id: 's-carvone', name: '(S)-Carvone', alt: 'smells like caraway (rye bread)', src: 'r-carvone', op: { mirror: true }, con: 'carvone', stereo: { t: 'rs', v: 'S' }, desc: 'six-carbon ring with a C=O, a CH₃ and a C(=CH₂)CH₃ group' },

    { id: 'glucose', name: 'Glucose', alt: 'open-chain form', con: 'glucose', desc: '6-carbon chain with the C=O on carbon 1 (an aldehyde)' },
    { id: 'fructose', name: 'Fructose', alt: 'open-chain form', con: 'fructose', desc: '6-carbon chain with the C=O on carbon 2 (a ketone)' }
  ];
  const byId = {};
  LIB.forEach(function (e) { byId[e.id] = e; });
  ISO.LIB = LIB;
  ISO.entry = function (id) { return byId[id]; };
  /** Name as written mid-sentence: "trans-But-2-ene" -> "trans-but-2-ene", "(R)-Carvone" -> "(R)-carvone". */
  ISO.lowerName = function (name) {
    return String(name).replace(/^((?:cis-|trans-|\([RS]\)-|[\d,]+-)*)([A-Z])(?=[a-z])/, function (m, p, c) { return p + c.toLowerCase(); });
  };

  // Work out whether PubChem's CHBrClF model is the R or S form (priorities Br > Cl > F > H).
  (function labelCHBrClF() {
    if (!RAW.chbrclf) return;
    const m = G.fromRaw(RAW.chbrclf);
    const find = function (el) { return m.atoms.findIndex(function (a) { return a.el === el; }); };
    const rs = G.chirality(m, find('C'), [find('Br'), find('Cl'), find('F')]);
    const other = rs === 'R' ? 'S' : 'R';
    byId.chbrclf.stereo.v = rs;
    byId['chbrclf-mirror'].stereo.v = other;
    byId.chbrclf.name = '(' + rs + ')-Bromochlorofluoromethane';
    byId['chbrclf-mirror'].name = '(' + other + ')-Bromochlorofluoromethane';
  })();

  const cache = {};
  /** Returns the molecule for an id. Shared object: use ISO.fresh() if you want to change it. */
  ISO.get = function (id) {
    if (cache[id]) return cache[id];
    const e = byId[id];
    if (!e) throw new Error('Unknown molecule: ' + id);
    const raw = RAW[e.src || e.id];
    if (!raw) throw new Error('Missing 3D data for: ' + (e.src || e.id));
    let mol = G.fromRaw(raw);
    if (e.op && e.op.mirror) mol = G.mirror(mol);
    if (e.op && e.op.twist) {
      const bond = G.twistBond(mol);
      const side = G.side(mol, bond[0], bond[1]);
      G.rotateAbout(mol, side, bond[0], bond[1], e.op.twist * Math.PI / 180);
    }
    mol.id = id;
    mol.name = e.name;
    mol.alt = e.alt || '';
    mol.formula = G.formula(mol);
    cache[id] = mol;
    return mol;
  };
  /** A private copy you can twist, recentre, etc. */
  ISO.fresh = function (id) {
    const m = ISO.get(id);
    const c = G.clone(m);
    c.id = m.id; c.name = m.name; c.alt = m.alt; c.formula = m.formula;
    return c;
  };

  /* ---------- Explore sets ---------- */
  ISO.SETS = [
    { id: 'c4h10', title: 'C4H10', ids: ['butane', 'isobutane'],
      tip: 'Switch to <b>Space-filling</b>. Which one is more compact?' },
    { id: 'c5h12', title: 'C5H12', ids: ['pentane', 'isopentane', 'neopentane'],
      tip: 'Hide the <b>H atoms</b> and turn on <b>Spin together</b> to compare the carbon skeletons.' },
    { id: 'c6h14', title: 'C6H14', ids: ['hexane', '2-methylpentane', '3-methylpentane', '22-dimethylbutane', '23-dimethylbutane'],
      tip: 'Hide the <b>H atoms</b>, then find the longest carbon chain in each one.' },
    { id: 'c4h8', title: 'C4H8', ids: ['but-1-ene', 'cis-but-2-ene', 'trans-but-2-ene', 'methylpropene', 'cyclobutane', 'methylcyclopropane'],
      tip: 'Which two are a cis/trans pair? Look at which side of the C=C the CH₃ groups sit on.' },
    { id: 'c2h2cl2', title: 'C2H2Cl2', ids: ['11-dce', 'cis-12-dce', 'trans-12-dce'],
      tip: 'Turn on <b>Labels</b>. Which one has both Cl atoms on the same carbon?' },
    { id: 'c2h6o', title: 'C2H6O', ids: ['ethanol', 'dimethyl-ether'],
      tip: 'Same atoms, but find the oxygen (red). Where does it sit in each one?' },
    { id: 'c6h12o6', title: 'C6H12O6', ids: ['glucose', 'fructose'],
      tip: 'Find the C=O (the red O with a double bond). Which carbon is it on in each sugar?' },
    { id: 'mirror', title: 'Mirror pairs', ids: ['r-butan-2-ol', 's-butan-2-ol', 'r-carvone', 's-carvone'], mirrored: [false, true, false, true],
      tip: 'Turn on <b>Spin together</b>. Each pair spins like a reflection in a mirror.' }
  ];

  /* ---------- Isomer Finder logic ---------- */
  ISO.RESULTS = {
    not: {
      title: 'Not isomers',
      text: 'Their molecular formulas are different, so they are simply different compounds.',
      example: ['ethanol', 'butane']
    },
    constitutional: {
      title: 'Constitutional isomers',
      text: 'Same molecular formula, but the atoms are connected in a different order.',
      example: ['butane', 'isobutane']
    },
    same: {
      title: 'Same molecule',
      text: 'Everything lines up after turning it around or spinning single bonds. Different picture, same molecule.',
      example: ['butane', 'butane-twisted']
    },
    enantiomers: {
      title: 'Enantiomers',
      text: 'Mirror images that can never be stacked on top of each other, like your left and right hands.',
      example: ['r-carvone', 's-carvone']
    },
    diastereomers: {
      title: 'Cis/trans isomers',
      sub: 'a type of diastereomer',
      text: 'Same connections, but the groups sit on the same side (cis) or opposite sides (trans) of a double bond, which can’t rotate.',
      example: ['cis-but-2-ene', 'trans-but-2-ene']
    }
  };

  ISO.FLOW = [
    { id: 'formula', q: 'Same molecular formula?', exits: { no: 'not' } },
    { id: 'connections', q: 'Atoms connected in the same order?', exits: { no: 'constitutional' } },
    { id: 'stack', q: 'Can one sit exactly on top of the other?', exits: { yes: 'same' } },
    { id: 'mirror', q: 'Are they mirror images?', exits: { yes: 'enantiomers', no: 'diastereomers' } }
  ];

  function stereoText(e) {
    if (!e.stereo) return e.twisted ? 'twisted around a single bond (single bonds spin freely)' : 'no cis/trans or mirror form';
    if (e.stereo.t === 'ct') return e.stereo.v + ' (groups on ' + (e.stereo.v === 'cis' ? 'the same side' : 'opposite sides') + ' of the C=C)';
    return 'the (' + e.stereo.v + ') mirror form';
  }

  /** Walks the decision tree for two library molecules. */
  ISO.compare = function (idA, idB) {
    const A = ISO.get(idA), B = ISO.get(idB);
    const eA = byId[idA], eB = byId[idB];
    const steps = [];
    const sameFormula = A.formula === B.formula;
    steps.push({ id: 'formula', ans: sameFormula, a: A.formula, b: B.formula });
    if (!sameFormula) return { steps: steps, result: 'not' };

    const sameCon = eA.con === eB.con;
    steps.push({ id: 'connections', ans: sameCon, a: eA.desc, b: eB.desc });
    if (!sameCon) return { steps: steps, result: 'constitutional' };

    const sA = eA.stereo, sB = eB.stereo;
    const sameStereo = (!sA && !sB) || (!!sA && !!sB && sA.t === sB.t && sA.v === sB.v);
    steps.push({ id: 'stack', ans: sameStereo, a: stereoText(eA), b: stereoText(eB) });
    if (sameStereo) return { steps: steps, result: 'same' };

    const mirror = !!sA && !!sB && sA.t === 'rs' && sB.t === 'rs' && sA.v !== sB.v;
    steps.push({ id: 'mirror', ans: mirror, a: stereoText(eA), b: stereoText(eB) });
    return { steps: steps, result: mirror ? 'enantiomers' : 'diastereomers' };
  };

  /** Library grouped by formula, for the Finder's dropdowns. */
  ISO.libraryGroups = function () {
    const groups = [];
    const index = {};
    LIB.forEach(function (e) {
      const f = ISO.get(e.id).formula;
      if (!(f in index)) { index[f] = groups.length; groups.push({ formula: f, items: [] }); }
      groups[index[f]].items.push(e);
    });
    return groups;
  };
})();
