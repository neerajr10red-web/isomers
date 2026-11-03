/* Isomers by Neeraj the Beloved — shared helpers: dark mode, tabs, formulas, small animations. */
(function () {
  'use strict';
  const ISO = window.ISO = window.ISO || {};

  ISO.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const svg = function (inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  };
  const ICONS = ISO.ICONS = {
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    expand: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>')
  };

  /* ---------- Dark mode ---------- */
  const THEME_KEY = 'iso-theme';
  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  ISO.currentTheme = function () {
    return document.documentElement.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');
  };
  function updateThemeButtons() {
    const dark = ISO.currentTheme() === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = dark ? 'Light mode' : 'Dark mode';
      b.innerHTML = dark ? ICONS.sun : ICONS.moon;
    });
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage blocked: fine */ }
    updateThemeButtons();
    document.dispatchEvent(new CustomEvent('iso:theme'));
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = function () { updateThemeButtons(); document.dispatchEvent(new CustomEvent('iso:theme')); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- Formulas: "C4H10" -> C<sub>4</sub>H<sub>10</sub> ---------- */
  ISO.formulaHTML = function (f) {
    return '<span class="formula">' + String(f).replace(/(\d+)/g, '<sub>$1</sub>') + '</span>';
  };
  /** Plain text with Unicode subscripts, for places HTML can't go (like <option>). */
  ISO.formulaText = function (f) {
    return String(f).replace(/\d/g, function (d) { return '₀₁₂₃₄₅₆₇₈₉'[d]; });
  };
  ISO.escape = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Tabs (role=tablist), remembering the open tab in the #hash ---------- */
  ISO.initTabs = function (tablist, onChange) {
    const tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    function select(tab, opts) {
      opts = opts || {};
      tabs.forEach(function (t) {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (opts.focus) tab.focus();
      if (opts.updateHash !== false && history.replaceState) {
        try { history.replaceState(null, '', '#' + tab.dataset.hash); } catch (e) { /* some embedded frames refuse; harmless */ }
      }
      if (onChange) onChange(tab.dataset.hash);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        let j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (j >= 0) { e.preventDefault(); select(tabs[j], { focus: true }); }
      });
    });
    function fromHash() {
      const h = (location.hash || '').slice(1);
      return tabs.filter(function (x) { return x.dataset.hash === h; })[0] || tabs[0];
    }
    window.addEventListener('hashchange', function () { select(fromHash(), { updateHash: false }); });
    select(fromHash(), { updateHash: false });
    return { select: function (hash) { const t = tabs.filter(function (x) { return x.dataset.hash === hash; })[0]; if (t) select(t); } };
  };

  /* ---------- Small animations ---------- */
  ISO.ease = {
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    outBack: function (t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  /** Calls onFrame(progress 0..1) for `ms` milliseconds. Returns a function that cancels it. */
  ISO.animate = function (ms, onFrame, onDone, easing) {
    const ease = easing || ISO.ease.inOut;
    if (ISO.reducedMotion) ms = Math.min(ms, 120);
    let start = 0, raf = 0, cancelled = false;
    function step(t) {
      if (cancelled) return;
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      onFrame(ease(p), p);
      if (p < 1) raf = requestAnimationFrame(step);
      else if (onDone) onDone();
    }
    raf = requestAnimationFrame(step);
    return function () { cancelled = true; cancelAnimationFrame(raf); };
  };

  /* ---------- Page setup ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(ISO.currentTheme() === 'dark' ? 'light' : 'dark'); });
    });
    updateThemeButtons();
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      if ((a.getAttribute('href') || '').toLowerCase() === here) a.setAttribute('aria-current', 'page');
    });
  });
})();
