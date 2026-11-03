# Isomers by Neeraj the Beloved

3D isomer models you can turn, twist and compare. Made by Neeraj for SCH4U Chemistry.

**Live site:** https://neerajr10red-web.github.io/isomers/

## What's on it

- **3D Lab**
  - **Explore:** every isomer of C₄H₁₀, C₅H₁₂, C₆H₁₄, C₄H₈, C₂H₂Cl₂, C₂H₆O and C₆H₁₂O₆, plus mirror pairs.
  - **Spin the Bond:** why only double bonds give cis/trans isomers.
  - **Mirror Challenge:** try to stack a molecule on its mirror image.
- **Isomer Finder:** pick two molecules and it works out what kind of isomers they are.

Drag a model to turn it, and double-click to reset it. Ctrl + scroll zooms.

Direct links to each part:
- `lab.html#spin` (Spin the Bond)
- `lab.html#mirror` (Mirror Challenge)
- `lab.html#c4h8` (Explore, on one formula)
- `finder.html?a=butane&b=isobutane` (Finder, with a pair already picked)

## Offline

Double-click `index.html`. Everything is in this folder, so no internet is needed.

## Updating the site

In the repository on GitHub, click **Add file → Upload files**, drag in the changed files, and click **Commit changes**. For files in the `css` or `js` folder, open that folder first, then upload. The site updates in about a minute.

## How it works

Plain HTML, CSS and JavaScript with no libraries. `js/viewer3d.js` draws the 3D models. `js/structures.js` holds the 3D coordinates, which come from PubChem. `js/molecules.js` holds the names and how the molecules are related.

## Credits

3D structures are from [PubChem](https://pubchem.ncbi.nlm.nih.gov) (U.S. National Library of Medicine). The code is under the MIT License (see `LICENSE`).
