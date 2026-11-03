/* Isomers by Neeraj the Beloved — Isomer Finder: compare two models, or answer the questions yourself */
(function () {
  'use strict';
  const ISO = window.ISO;
  const Q = ISO.quat;
  const $ = function (id) { return document.getElementById(id); };

  /* ---------- The four questions (shared by both modes) ---------- */
  function buildFlow(ol) {
    ol.innerHTML = ISO.FLOW.map(function (st, i) {
      return '<li class="flow-step" data-step="' + st.id + '">' +
        '<span class="flow-num">' + (i + 1) + '.</span>' +
        '<div class="flow-body"><p class="flow-q">' + st.q + '</p><p class="flow-ev"></p></div>' +
        '<span class="flow-ans"></span></li>';
    }).join('');
  }
  function resetFlow(ol) {
    ol.classList.remove('running', 'finished');
    ol.querySelectorAll('.flow-step').forEach(function (li) {
      li.className = 'flow-step';
      li.querySelector('.flow-ev').innerHTML = '';
      li.querySelector('.flow-ans').textContent = '';
    });
  }
  function activate(ol, id) {
    ol.querySelectorAll('.flow-step').forEach(function (li) { li.classList.toggle('active', li.dataset.step === id); });
  }
  function markStep(ol, id, ans, evidence) {
    const li = ol.querySelector('[data-step="' + id + '"]');
    li.classList.remove('active', 'dim');
    li.classList.add('done', ans ? 'yes' : 'no');
    li.querySelector('.flow-ans').textContent = ans ? 'Yes' : 'No';
    if (evidence) li.querySelector('.flow-ev').innerHTML = evidence;
  }
  function finishFlow(ol) {
    ol.classList.remove('running');
    ol.classList.add('finished');
    activate(ol, null);
    ol.querySelectorAll('.flow-step').forEach(function (li) { if (!li.classList.contains('done')) li.classList.add('dim'); });
  }
  function nextStep(id, ans) {
    const st = ISO.FLOW.filter(function (s) { return s.id === id; })[0];
    const exit = st.exits[ans ? 'yes' : 'no'];
    if (exit) return { result: exit };
    return { step: ISO.FLOW[ISO.FLOW.indexOf(st) + 1].id };
  }
  function verdictHTML(key, extra) {
    const r = ISO.RESULTS[key];
    return '<p class="kicker">The Great Neeraj says</p>' +
      '<h3>' + r.title + '</h3>' +
      (r.sub ? '<p class="muted">(' + r.sub + ')</p>' : '') +
      '<p>' + r.text + '</p>' + (extra || '');
  }

  /* =========================================================
     COMPARE: two molecules from the list, shown in 3D
     ========================================================= */
  const EXAMPLES = [
    ['butane', 'isobutane', 'butane vs 2-methylpropane'],
    ['cis-but-2-ene', 'trans-but-2-ene', 'cis vs trans but-2-ene'],
    ['glucose', 'fructose', 'glucose vs fructose'],
    ['r-carvone', 's-carvone', 'the two carvones'],
    ['butane', 'butane-twisted', 'butane vs twisted butane']
  ];

  const Compare = {
    init: function () {
      const self = this;
      const groups = ISO.libraryGroups();
      ['pick-a', 'pick-b'].forEach(function (id) {
        const sel = $(id);
        sel.innerHTML = groups.map(function (g) {
          return '<optgroup label="' + ISO.formulaText(g.formula) + '">' + g.items.map(function (e) {
            const m = ISO.get(e.id);
            const label = m.name + (e.alt && !e.twisted ? ' (' + e.alt + ')' : '');
            return '<option value="' + e.id + '">' + ISO.escape(label) + '</option>';
          }).join('') + '</optgroup>';
        }).join('');
        sel.addEventListener('change', function () { self.update(); });
      });
      this.cardA = ISO.makeViewerCard({ parent: $('stage-a') });
      this.cardB = ISO.makeViewerCard({ parent: $('stage-b') });

      EXAMPLES.forEach(function (ex, i) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = ex[2];
        b.addEventListener('click', function () { self.load(ex[0], ex[1], true); });
        $('presets').appendChild(b);
        if (i < EXAMPLES.length - 1) $('presets').appendChild(document.createTextNode(','));
      });
      buildFlow($('flow-compare'));
      $('run').addEventListener('click', function () { self.run(); });

      // Links like finder.html?a=butane&b=isobutane open with that pair already checked.
      const qs = new URLSearchParams(location.search);
      const a = qs.get('a'), b = qs.get('b');
      if (a && b && ISO.entry(a) && ISO.entry(b)) this.load(a, b, true);
      else this.load('butane', 'isobutane', false);
    },

    load: function (a, b, run) {
      $('pick-a').value = a;
      $('pick-b').value = b;
      this.update();
      if (run) this.run();
    },

    update: function () {
      const a = ISO.get($('pick-a').value), b = ISO.get($('pick-b').value);
      const eA = ISO.entry(a.id), eB = ISO.entry(b.id);
      // If B is A's mirror image, start it facing as a reflection of A.
      const mirrorPair = !!(eA.stereo && eB.stereo && eA.stereo.t === 'rs' && eB.stereo.t === 'rs' && eA.con === eB.con && eA.stereo.v !== eB.stereo.v);
      this.cardB.viewer.initialQ = mirrorPair ? Q.mirror(ISO.DEFAULT_VIEW) : ISO.DEFAULT_VIEW.slice();
      const caption = function (e, m) { return (e.alt ? e.alt + ' · ' : '') + ISO.formulaText(m.formula); };
      this.cardA.setCaption(ISO.escape(a.name), caption(eA, a));
      this.cardB.setCaption(ISO.escape(b.name), caption(eB, b));
      this.cardA.viewer.setMolecule(a, { frame: [a, b], transition: true });
      this.cardB.viewer.setMolecule(b, { frame: [a, b], transition: true });
      this.stop();
      resetFlow($('flow-compare'));
      $('verdict-compare').hidden = true;
    },

    stop: function () {
      (this.timers || []).forEach(clearTimeout);
      this.timers = [];
    },

    evidence: function (st) {
      if (st.id === 'formula') return 'A: ' + ISO.formulaHTML(st.a) + ', B: ' + ISO.formulaHTML(st.b);
      if (st.id === 'mirror') {
        const sA = ISO.entry($('pick-a').value).stereo, sB = ISO.entry($('pick-b').value).stereo;
        if (st.ans) return 'B is the reflection of A, and they can’t be stacked.';
        if (sA && sB && sA.t === 'ct' && sB.t === 'ct') return 'A is ' + sA.v + ' and B is ' + sB.v + ' around the C=C.';
        return '';
      }
      return 'A: ' + ISO.escape(st.a) + '<br>B: ' + ISO.escape(st.b);
    },

    extra: function (key) {
      const a = ISO.get($('pick-a').value);
      const set = ISO.SETS.filter(function (s) { return s.title === a.formula; })[0];
      const link = function (href, text) { return '<p><a href="' + href + '">' + text + '</a></p>'; };
      if (key === 'enantiomers') return link('lab.html#mirror', 'Try to stack them in the Mirror Challenge');
      if (key === 'diastereomers' || key === 'same') return link('lab.html#spin', 'See why in Spin the Bond');
      if (key === 'constitutional' && set) return link('lab.html#' + set.id, 'See every ' + ISO.formulaHTML(a.formula) + ' isomer in 3D');
      return '';
    },

    run: function () {
      const self = this, ol = $('flow-compare');
      const res = ISO.compare($('pick-a').value, $('pick-b').value);
      this.stop();
      resetFlow(ol);
      ol.classList.add('running');
      $('verdict-compare').hidden = true;
      const delay = ISO.reducedMotion ? 0 : 500;
      // The answer sits below the models, so bring it into view (no scroll if it's already showing).
      $('compare-results').scrollIntoView({ behavior: ISO.reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
      let i = 0;
      const next = function () {
        if (i < res.steps.length) {
          const st = res.steps[i];
          activate(ol, st.id);
          self.timers.push(setTimeout(function () {
            markStep(ol, st.id, st.ans, self.evidence(st));
            i++;
            next();
          }, delay));
        } else {
          finishFlow(ol);
          const v = $('verdict-compare');
          v.innerHTML = verdictHTML(res.result, self.extra(res.result));
          v.hidden = false;
          // On phones the verdict is under the questions, so make sure it's visible too.
          v.scrollIntoView({ behavior: ISO.reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
        }
      };
      next();
    }
  };

  /* =========================================================
     YOUR OWN MOLECULES: answer the four questions yourself
     ========================================================= */
  const HINTS = {
    formula: 'Count each type of atom in both. For example, butane and 2-methylpropane are both C₄H₁₀.',
    connections: 'Follow the longest carbon chain and see where each branch, double bond or other atom (like O or Cl) is attached. Bending or flipping a drawing doesn’t change what’s connected to what.',
    stack: 'Imagine turning one around and spinning its single bonds. If every atom can land on the same kind of atom in the other, they’re the same molecule.',
    mirror: 'Is one a reflection of the other? Look for a carbon with four different groups on it. If they aren’t reflections, check the groups around the C=C: same side (cis) or opposite sides (trans)?'
  };

  const Guided = {
    init: function () {
      const self = this;
      buildFlow($('flow-guided'));
      $('g-yes').addEventListener('click', function () { self.answer(true); });
      $('g-no').addEventListener('click', function () { self.answer(false); });
      $('g-back').addEventListener('click', function () { self.path.pop(); self.render(); });
      this.path = [];
      this.render();
    },

    answer: function (yes) {
      this.path.push(yes);
      this.render();
      if (!$('guided-card').hidden) $('g-yes').focus();
    },

    /** Redraws the questions and answers from the list of answers so far. */
    render: function () {
      const self = this, ol = $('flow-guided');
      resetFlow(ol);
      let at = 'formula', result = null;
      this.path.forEach(function (ans) {
        markStep(ol, at, ans, null);
        const n = nextStep(at, ans);
        if (n.result) result = n.result; else at = n.step;
      });
      const card = $('guided-card'), verdict = $('verdict-guided');
      if (result) {
        finishFlow(ol);
        card.hidden = true;
        const ex = ISO.RESULTS[result].example;
        verdict.innerHTML = verdictHTML(result,
          '<div class="btn-row"><button type="button" class="btn primary" id="g-example">See an example in 3D</button>' +
          '<button type="button" class="btn" id="g-restart">Start over</button></div>');
        verdict.hidden = false;
        $('g-restart').addEventListener('click', function () { self.path = []; self.render(); $('g-yes').focus(); });
        $('g-example').addEventListener('click', function () {
          Finder.tabs.select('compare');
          Compare.load(ex[0], ex[1], true);
        });
        return;
      }
      ol.classList.add('running');
      activate(ol, at);
      ol.querySelectorAll('.flow-step').forEach(function (li) {
        if (!li.classList.contains('done') && li.dataset.step !== at) li.classList.add('dim');
      });
      card.hidden = false;
      verdict.hidden = true;
      const idx = ISO.FLOW.map(function (s) { return s.id; }).indexOf(at);
      $('g-count').textContent = 'Question ' + (idx + 1) + ' of 4';
      $('g-q').textContent = ISO.FLOW[idx].q;
      $('g-hint').textContent = 'How to check: ' + HINTS[at];
      $('g-back').hidden = this.path.length === 0;
    }
  };

  const Finder = {};
  document.addEventListener('DOMContentLoaded', function () {
    Finder.tabs = ISO.initTabs(document.querySelector('.tabs'));
    Compare.init();
    Guided.init();
  });
})();
