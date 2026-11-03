# Isomers by Neeraj the Beloved

Interactive 3D models for learning about isomers, made for SCH4U Organic Chemistry. It's free for anyone to use, with no ads, sign-ups or tracking.

## What's inside

- **3D Model Lab** (`lab.html`)
  - **Explore isomers:** every isomer of C₄H₁₀, C₅H₁₂, C₆H₁₄, C₄H₈, C₂H₂Cl₂, C₂H₆O and C₆H₁₂O₆, plus mirror pairs, side by side and to scale. It offers ball-and-stick or space-filling views, hide/show H atoms, labels, "spin together" and full screen.
  - **Spin the Bond:** twist a single, double or triple bond to see why only double bonds give cis/trans isomers.
  - **Mirror Challenge:** try to stack a molecule on a turned copy of itself (easy), then on its mirror image (impossible).
- **Isomer Finder** (`finder.html`): pick any two molecules and it walks through the questions to decide whether they are constitutional isomers, cis/trans isomers, enantiomers, the same molecule, or not isomers. There's also a yes/no mode for molecules on paper.

Controls: drag to rotate, pinch (or Ctrl + scroll) to zoom, and double-click to reset. When a model is selected, the arrow keys rotate it.

## Use it without the internet

Double-click `index.html`. Everything is in this folder, so it works offline, which is handy if the school Wi-Fi is slow.

## Publish it free on GitHub Pages

1. Go to [github.com](https://github.com) and sign in (or create a free account).
2. Click **+** (top right) → **New repository**. Name it `isomers`, choose **Public**, and click **Create repository**.
3. On the new page, click **uploading an existing file**. Drag in **everything inside this folder** (`index.html`, `lab.html`, `finder.html`, `404.html`, `README.md`, `LICENSE`, and the `css` and `js` folders). Then click **Commit changes**.
4. Open **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, and folder to **/ (root)**, then click **Save**.
5. Wait a minute or two and refresh. Your link appears at the top of that page: `https://YOUR-USERNAME.github.io/isomers/`

**To update later:** open the repository, click **Add file → Upload files**, drag in the changed files, then click **Commit changes**. The site updates within a minute or two.

## How it works

Plain HTML, CSS and JavaScript, with no frameworks, build step or outside libraries.

- `js/viewer3d.js` is a small 3D ball-and-stick renderer written for this site.
- `js/structures.js` holds the 3D coordinates of every molecule, taken from PubChem's 3D conformers.
- `js/molecules.js` holds names, formulas and how the molecules relate (same connections, cis/trans, mirror forms).
- `js/lab.js`, `js/finder.js` and `js/home.js` run the pages.

### Adding a molecule

1. On [PubChem](https://pubchem.ncbi.nlm.nih.gov), open the compound, then go to **Download → 3D Conformer → SDF**.
2. Add an entry to `js/structures.js` in the same format as the others: `atoms` as `[element, x, y, z]` and `bonds` as `[atomA, atomB, order]`, with atoms counted from 0.
3. Add it to `LIB` in `js/molecules.js` (and to a set in `ISO.SETS` if you want it in Explore).

## Credits

- Made by Neeraj the Beloved.
- 3D structures: [PubChem](https://pubchem.ncbi.nlm.nih.gov), National Center for Biotechnology Information, U.S. National Library of Medicine.
- Code is under the MIT License (see `LICENSE`), so you can use it, share it and change it.
