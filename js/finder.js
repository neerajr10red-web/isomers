/* Isomers by Neeraj the Beloved — Isomer Finder: compare two models, or answer guided questions */
(function () {
  'use strict';
  const ISO = window.ISO;
  const Q = ISO.quat;
  const $ = function (id) { return document.getElementById(id); };

  /* ---------- Flowchart (shared by both modes) ---------- */
  function buildFlow(ol) {
    ol.innerHTML = ISO.FLOW.map(function (st, i) {
      const exits = Object.keys(st.exits).map(function (k) {
        return '<span class="flow-exit" data-when="' + k + '">' + (k === 'yes' ? 'Yes' : 'No') + ' → ' + ISO.RESULTS[st.exits[k]].title + '</span>';
      }).join('');
      return '<li class="flow-step" data-step="' + st.id + '">' +
        '<div class="flow-main"><span class="flow-num">' + (i + 1) + '</span>' +
        '<div class="flow-body"><p class="flow-q">' + st.q + '</p><p class="flow-ev"></p></div>' +
        '<span class="flow-ans"></span></div>' +
        '<div class="flow-exits">' + exits + '</div></li>';
    }).join('');
  }
  function resetFlow(ol) {
    ol.classList.remove('running', 'finished');
    ol.querySelectorAll('.flow-step').forEach(function (li) {
      li.className = 'flow-step';
      li.querySelector('.flow-ev').innerHTML = '';
      li.querySelector('.flow-ans').textContent = '';
    });
    ol.querySelectorAll('.flow-exit').forEach(function (e) { e.classList.remove('taken'); });
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
    const ex = li.querySelector('.flow-exit[data-when="' + (ans ? 'yes' : 'no') + '"]');
    if (ex) ex.classList.add('taken');
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
    return '<p class="verdict-eyebrow">The Great Neeraj has ruled</p>' +
      '<h3>' + r.title + '</h3>' +
      (r.sub ? '<p class="muted" style="margin-top:-0.3rem">(' + r.sub + ')</p>' : '') +
      '<p>' + r.text + '</p>' + (extra || '');
  }

  /* =========================================================
     COMPARE: two molecules from the library, shown in 3D
     ========================================================= */
  const PRESETS = [
    ['butane', 'isobutane', 'Butane vs 2-methylpropane'],
    ['cis-but-2-ene', 'trans-but-2-ene', 'cis vs trans but-2-ene'],
    ['r-carvone', 's-carvone', 'The two carvones'],
    ['butane', 'butane-twisted', 'Butane vs twisted butane'],
    ['glucose', 'fructose', 'Glucose vs fructose'],
    ['ethanol', 'butane', 'Ethanol vs butane']
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
      this.group = new ISO.SyncGroup();
      this.group.add(this.cardA.viewer, false).add(this.cardB.viewer, false);
      ISO.bindToggle($('opt-sync'), false, function (on) { self.group.setEnabled(on); });
      ISO.bindToggle($('opt-labels'), false, function (on) {
        self.cardA.viewer.setLabels(on);
        self.cardB.viewer.setLabels(on);
      });

      const presets = $('presets');
      PRESETS.forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = p[2];
        b.addEventListener('click', function () { self.load(p[0], p[1], true); });
        presets.appendChild(b);
      });
      buildFlow($('flow-compare'));
      $('run').addEventListener('click', function () { self.run(); });

      // Deep links: finder.html?a=butane&b=isobutane
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
      // If B is A's mirror image, show it as a reflection (and keep it that way when spinning together).
      const mirrorPair = !!(eA.stereo && eB.stereo && eA.stereo.t === 'rs' && eB.stereo.t === 'rs' && eA.con === eB.con && eA.stereo.v !== eB.stereo.v);
      this.cardB.viewer.initialQ = mirrorPair ? Q.mirror(ISO.DEFAULT_VIEW) : ISO.DEFAULT_VIEW.slice();
      this.group.setMirrored(this.cardB.viewer, mirrorPair);
      const frame = [a, b];
      this.cardA.setCaption(ISO.escape(a.name), (eA.alt || '') + (eA.alt ? ' · ' : '') + ISO.formulaText(a.formula));
      this.cardB.setCaption(ISO.escape(b.name), (eB.alt || '') + (eB.alt ? ' · ' : '') + ISO.formulaText(b.formula));
      this.cardA.viewer.setMolecule(a, { frame: frame, transition: true });
      this.cardB.viewer.setMolecule(b, { frame: frame, transition: true });
      if (this.group.enabled) this.group.setEnabled(true);
      this.stop();
      resetFlow($('flow-compare'));
      $('verdict-compare').hidden = true;
      $('verdict-compare-empty').hidden = false;
    },

    stop: function () {
      (this.timers || []).forEach(clearTimeout);
      this.timers = [];
    },

    evidence: function (st) {
      if (st.id === 'formula') return 'A: ' + ISO.formulaHTML(st.a) + ' · B: ' + ISO.formulaHTML(st.b);
      if (st.id === 'mirror') {
        const sA = ISO.entry($('pick-a').value).stereo, sB = ISO.entry($('pick-b').value).stereo;
        if (st.ans) return 'Yes: B is the reflection of A, and the two can’t be stacked.';
        if (sA && sB && sA.t === 'ct' && sB.t === 'ct') return 'No: A is ' + sA.v + ' and B is ' + sB.v + ' around the C=C.';
        return 'No.';
      }
      return 'A: ' + ISO.escape(st.a) + '<br>B: ' + ISO.escape(st.b);
    },

    extra: function (key) {
      const a = ISO.get($('pick-a').value);
      const set = ISO.SETS.filter(function (s) { return s.title === a.formula; })[0];
      const link = function (href, text) {
        return '<div class="btn-row"><a class="btn" href="' + href + '">' + text + ' →</a></div>';
      };
      if (key === 'enantiomers') return link('lab.html#mirror', 'Try to stack them in the Mirror Challenge');
      if (key === 'diastereomers' || key === 'same') return link('lab.html#spin', 'See why in Spin the Bond');
      if (key === 'constitutional' && set) return link('lab.html#explore', 'See every ' + ISO.formulaHTML(a.formula) + ' isomer in 3D');
      return '';
    },

    run: function () {
      const self = this, ol = $('flow-compare');
      const res = ISO.compare($('pick-a').value, $('pick-b').value);
      this.stop();
      resetFlow(ol);
      ol.classList.add('running');
      $('verdict-compare').hidden = true;
      $('verdict-compare-empty').hidden = true;
      const delay = ISO.reducedMotion ? 0 : 650;
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
        }
      };
      next();
    }
  };

  /* =========================================================
     GUIDED: yes/no questions for any two molecules
     ========================================================= */
  const HINTS = {
    formula: 'Count every atom of each element in both molecules. For example, butane and 2-methylpropane are both C₄H₁₀.',
    connections: 'Follow the longest carbon chain, then note where each branch, double bond or other atom (like O or Cl) is attached. Bending, turning or flipping a drawing doesn’t change its connections.',
    stack: 'Imagine turning one molecule around and spinning its single bonds. If every atom can land on the same kind of atom in the other one, they’re the same molecule.',
    mirror: 'Is one the reflection of the other? Look for a carbon holding four different groups. If they aren’t reflections, check the groups around the C=C: same side (cis) or opposite sides (trans)?'
  };

  const Guided = {
    init: function () {
      const self = this;
      buildFlow($('flow-guided'));
      $('g-yes').addEventListener('click', function () { self.answer(true); });
      $('g-no').addEventListener('click', function () { self.answer(false); });
      $('g-back').addEventListener('click', function () { self.back(); });
      this.restart();
    },

    restart: function () {
      this.path = [];
      this.render();
    },

    answer: function (yes) {
      this.path.push(yes);
      this.render();
      const card = $('guided-card');
      if (!card.hidden) $('g-yes').focus();
    },

    back: function () {
      this.path.pop();
      this.render();
    },

    /** Re-draws the flowchart and question from the list of answers so far. */
    render: function () {
      const ol = $('flow-guided');
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
          '<div class="btn-row">' +
          '<button type="button" class="btn btn-primary" id="g-example" data-icon="cube">See an example in 3D</button>' +
          '<button type="button" class="btn" id="g-restart" data-icon="reset">Start over</button></div>');
        verdict.hidden = false;
        verdict.querySelectorAll('[data-icon]').forEach(function (el) { el.insertAdjacentHTML('afterbegin', ISO.ICONS[el.dataset.icon]); });
        const self = this;
        $('g-restart').addEventListener('click', function () { self.restart(); $('g-yes').focus(); });
        $('g-example').addEventListener('click', function () {
          Finder.tabs.select('compare');
          Compare.load(ex[0], ex[1], true);
          window.scrollTo({ top: 0, behavior: ISO.reducedMotion ? 'auto' : 'smooth' });
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
      $('g-count').textContent = 'Question ' + (idx + 1);
      $('g-q').textContent = ISO.FLOW[idx].q;
      $('g-hint').innerHTML = ISO.ICONS.bulb + '<span><b>How to check:</b> ' + HINTS[at] + '</span>';
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
