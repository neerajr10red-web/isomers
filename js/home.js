/* Isomers by Neeraj the Beloved — home page: the C4H10 hero model */
(function () {
  'use strict';
  const ISO = window.ISO;

  document.addEventListener('DOMContentLoaded', function () {
    const host = document.getElementById('hero-model');
    if (!host) return;
    const ids = ['butane', 'isobutane'];
    const mols = ids.map(ISO.get);
    const card = ISO.makeViewerCard({
      parent: host, className: 'hero-model', caption: false,
      viewer: { autoSpin: true, spinSpeed: 0.4 }
    });
    const v = card.viewer;

    const controls = document.createElement('div');
    controls.className = 'hero-controls';
    controls.innerHTML =
      '<div class="seg" role="group" aria-label="Switch between the two isomers of C4H10">' +
      ids.map(function (id, i) {
        return '<button type="button" data-mol="' + id + '" aria-pressed="' + (i === 0) + '">' + ISO.escape(mols[i].name) + '</button>';
      }).join('') +
      '</div><div class="atom-tally" id="atom-tally"></div>';
    card.el.appendChild(controls);

    const tally = controls.querySelector('#atom-tally');
    function showTally(mol) {
      const n = ISO.geom.counts(mol);
      tally.setAttribute('aria-label', mol.name + ' has ' + n.C + ' carbon and ' + n.H + ' hydrogen atoms');
      tally.innerHTML = ['C', 'H'].map(function (el) {
        const st = ISO.ELEMENTS[el];
        return '<span class="tally"><i style="background:' + st.color + ';color:' + st.ink + '">' + el + '</i>× ' + n[el] + '</span>';
      }).join('') + '<span class="muted" style="font-weight:600">same atoms!</span>';
    }

    let current = 0;
    function show(i, transition) {
      current = i;
      controls.querySelectorAll('[data-mol]').forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      v.setMolecule(mols[i], { frame: mols, keepView: true, transition: transition });
      showTally(mols[i]);
    }
    v.setMolecule(mols[0], { frame: mols });
    show(0, false);

    // Swap between the two isomers every few seconds until someone takes over.
    let timer = ISO.reducedMotion ? 0 : setInterval(function () { show(1 - current, true); }, 5000);
    const stopAuto = function () { if (timer) { clearInterval(timer); timer = 0; } };
    v.on('dragstart', stopAuto);
    controls.querySelectorAll('[data-mol]').forEach(function (b, j) {
      b.addEventListener('click', function () { stopAuto(); if (j !== current) show(j, true); });
    });
  });
})();
