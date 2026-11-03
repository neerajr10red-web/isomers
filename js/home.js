/* Isomers by Neeraj the Beloved — home page: butane and 2-methylpropane side by side */
(function () {
  'use strict';
  const ISO = window.ISO;

  document.addEventListener('DOMContentLoaded', function () {
    const host = document.getElementById('home-models');
    if (!host) return;
    const pair = [
      { id: 'butane', note: 'straight chain' },
      { id: 'isobutane', note: 'branched' }
    ];
    const mols = pair.map(function (p) { return ISO.get(p.id); });
    pair.forEach(function (p, i) {
      const card = ISO.makeViewerCard({ parent: host });
      card.setCaption(ISO.escape(mols[i].name), p.note + ' · ' + ISO.formulaText(mols[i].formula));
      card.viewer.setMolecule(mols[i], { frame: mols });
    });
  });
})();
