/* Isomers by Neeraj the Beloved — shared page helpers:
   theme toggle, tabs, formula formatting, small animations. */
(function () {
  'use strict';
  const ISO = window.ISO = window.ISO || {};

  ISO.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Theme (light / dark) ---------- */
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

  /* ---------- Icons (inline SVG, stroke = currentColor) ---------- */
  const svg = function (inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  };
  const ICONS = ISO.ICONS = {
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    expand: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
    drag: svg('<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'),
    spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
    cube: svg('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>'),
    twist: svg('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'),
    mirror: svg('<path d="M12 2v20" stroke-dasharray="2 3"/><path d="M8 7L3 12l5 5M16 7l5 5-5 5"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    bulb: svg('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>'),
    play: svg('<path d="M7 4l13 8-13 8z"/>'),
    flip: svg('<path d="M4 7h13a3 3 0 0 1 0 6H7"/><path d="M8 3L4 7l4 4"/><path d="M20 17H7"/><path d="M16 21l4-4-4-4"/>'),
    reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    shuffle: svg('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    check: svg('<path d="M4 12l5 5L20 6"/>')
  };

  /* ---------- Formula formatting: "C4H10" -> C<sub>4</sub>H<sub>10</sub> ---------- */
  ISO.formulaHTML = function (f) {
    return '<span class="formula">' + String(f).replace(/(\d+)/g, '<sub>$1</sub>') + '</span>';
  };
  /** Plain-text version with Unicode subscripts, for places HTML can't go (e.g. <option>). */
  ISO.formulaText = function (f) {
    return String(f).replace(/\d/g, function (d) { return '₀₁₂₃₄₅₆₇₈₉'[d]; });
  };
  ISO.escape = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Tabs (role=tablist) with #hash support ---------- */
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
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); select(tabs[j], { focus: true }); }
      });
    });
    function fromHash() {
      const h = (location.hash || '').slice(1);
      const t = tabs.filter(function (x) { return x.dataset.hash === h; })[0];
      return t || tabs[0];
    }
    window.addEventListener('hashchange', function () { select(fromHash(), { updateHash: false }); });
    select(fromHash(), { updateHash: false });
    return { select: function (hash) { const t = tabs.filter(function (x) { return x.dataset.hash === hash; })[0]; if (t) select(t); } };
  };

  /* ---------- Toggle button helper (aria-pressed) ---------- */
  ISO.bindToggle = function (btn, initial, onChange) {
    btn.setAttribute('aria-pressed', initial ? 'true' : 'false');
    btn.addEventListener('click', function () {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      onChange(on);
    });
    return {
      set: function (on) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); },
      get: function () { return btn.getAttribute('aria-pressed') === 'true'; }
    };
  };

  /* ---------- Tween helper ---------- */
  ISO.ease = {
    inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    outBack: function (t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  /** Runs onFrame(progress 0..1) for `ms` milliseconds. Returns a cancel function. */
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

  /* ---------- Confetti (tiny, no library) ---------- */
  ISO.confetti = function () {
    if (ISO.reducedMotion) return;
    const colors = ['#5146e0', '#e3342b', '#1ea84c', '#f2b453', '#3456e6', '#93d84a'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = (Math.random() * 100) + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 220) + 'px');
      p.style.setProperty('--rot', ((Math.random() - 0.5) * 900) + 'deg');
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      document.body.appendChild(p);
      setTimeout(function () { p.remove(); }, 2000);
    }
  };

  /* ---------- Page setup ---------- */
  function markNav() {
    const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.site-nav a').forEach(function (a) {
      const target = (a.getAttribute('href') || '').split('#')[0].toLowerCase();
      if (target === here || (here === '' && target === 'index.html')) a.setAttribute('aria-current', 'page');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      if (ICONS[el.dataset.icon]) el.insertAdjacentHTML('afterbegin', ICONS[el.dataset.icon]);
    });
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(ISO.currentTheme() === 'dark' ? 'light' : 'dark'); });
    });
    updateThemeButtons();
    markNav();
  });
})();
