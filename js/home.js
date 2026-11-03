/* Isomers by Neeraj the Beloved — home page: one big model that switches between the two C4H10 isomers */
(function () {
  'use strict';
  const ISO = window.ISO;

  document.addEventListener('DOMContentLoaded', function () {
    const host = document.getElementById('home-model');
    const label = document.getElementById('home-label');
    if (!host) return;
    const pair = [
      { mol: ISO.get('butane'), note: 'a straight chain' },
      { mol: ISO.get('isobutane'), note: 'a branched chain' }
    ];
    const frame = pair.map(function (p) { return p.mol; });
    const card = ISO.makeViewerCard({
      parent: host, className: 'hero-model', caption: false, fullscreen: false,
      viewer: { autoSpin: true, spinSpeed: 0.35 }
    });
    let current = 0;
    function show(i, transition) {
      current = i;
      const p = pair[i];
      card.viewer.setMolecule(p.mol, { frame: frame, keepView: transition, transition: transition });
      const text = p.mol.name + ', ' + ISO.formulaText(p.mol.formula) + ', ' + p.note;
      if (!transition || ISO.reducedMotion) { label.textContent = text; return; }
      label.style.opacity = '0'; // cross-fade the caption with the model
      setTimeout(function () { label.textContent = text; label.style.opacity = '1'; }, 250);
    }
    show(0, false);
    // Swap between the two isomers every few seconds until someone grabs the model.
    let timer = ISO.reducedMotion ? 0 : setInterval(function () { show(1 - current, true); }, 5000);
    card.viewer.on('dragstart', function () { if (timer) { clearInterval(timer); timer = 0; } });
  });
})();
